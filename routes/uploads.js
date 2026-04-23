// backend/routes/uploads.js - File Upload Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protectCustomer, protect } = require('../middleware/auth');
const Customer = require('../models/Customer');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create subdirectories
const profileDir = path.join(uploadsDir, 'profiles');
const documentsDir = path.join(uploadsDir, 'documents');
const tempDir = path.join(uploadsDir, 'temp');

[profileDir, documentsDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// File filter for documents
const documentFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/jpg',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpg', 'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, Word, and image files are allowed'), false);
    }
};

// Storage configuration for profile pictures
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profileDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `profile-${req.user.customerId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// Storage configuration for documents
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, documentsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `doc-${req.user.customerId}-${uniqueSuffix}-${cleanName}`);
    }
});

// Multer instances
const uploadProfile = multer({
    storage: profileStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uploadDocument = multer({
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// @route   POST /api/uploads/profile-picture
// @desc    Upload customer profile picture
// @access  Private (Customer)
router.post('/profile-picture', protectCustomer, uploadProfile.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const customer = req.customer;
        
        // Delete old profile picture if exists
        if (customer.profilePicture) {
            const oldPath = path.join(profileDir, path.basename(customer.profilePicture));
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        // Update customer profile
        customer.profilePicture = `/uploads/profiles/${req.file.filename}`;
        await customer.save();

        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            data: {
                profilePicture: customer.profilePicture,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('Profile picture upload error:', error);
        
        // Clean up uploaded file on error
        if (req.file) {
            const filePath = req.file.path;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to upload profile picture'
        });
    }
});

// @route   POST /api/uploads/documents
// @desc    Upload customer documents (ID, proof of address, etc.)
// @access  Private (Customer)
router.post('/documents', protectCustomer, uploadDocument.array('documents', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const customer = req.customer;
        const uploadedDocuments = [];

        for (const file of req.files) {
            const document = {
                filename: file.filename,
                originalName: file.originalname,
                path: `/uploads/documents/${file.filename}`,
                size: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
                category: req.body.category || 'general',
                description: req.body.description || ''
            };

            uploadedDocuments.push(document);
        }

        // Add documents to customer record
        if (!customer.documents) {
            customer.documents = [];
        }
        customer.documents.push(...uploadedDocuments);
        await customer.save();

        res.json({
            success: true,
            message: `${uploadedDocuments.length} documents uploaded successfully`,
            data: uploadedDocuments
        });

    } catch (error) {
        console.error('Document upload error:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to upload documents'
        });
    }
});

// @route   DELETE /api/uploads/documents/:documentId
// @desc    Delete customer document
// @access  Private (Customer)
router.delete('/documents/:documentId', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        const documentId = req.params.documentId;

        if (!customer.documents) {
            return res.status(404).json({
                success: false,
                error: 'No documents found'
            });
        }

        // Find document
        const documentIndex = customer.documents.findIndex(doc => doc._id.toString() === documentId);
        
        if (documentIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const document = customer.documents[documentIndex];
        
        // Delete file from filesystem
        const filePath = path.join(__dirname, '..', document.path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from customer record
        customer.documents.splice(documentIndex, 1);
        await customer.save();

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('Document deletion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete document'
        });
    }
});

// @route   GET /api/uploads/documents
// @desc    Get customer documents
// @access  Private (Customer)
router.get('/documents', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        
        res.json({
            success: true,
            data: customer.documents || []
        });

    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch documents'
        });
    }
});

// @route   GET /api/uploads/profile-picture/:customerId
// @desc    Get customer profile picture
// @access  Public (for serving images)
router.get('/profile-picture/:customerId', async (req, res) => {
    try {
        const customer = await Customer.findOne({ customerId: req.params.customerId });
        
        if (!customer || !customer.profilePicture) {
            return res.status(404).json({
                success: false,
                error: 'Profile picture not found'
            });
        }

        const imagePath = path.join(__dirname, '..', customer.profilePicture);
        
        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({
                success: false,
                error: 'Image file not found'
            });
        }

        res.sendFile(imagePath);

    } catch (error) {
        console.error('Get profile picture error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile picture'
        });
    }
});

// @route   GET /api/uploads/documents/:customerId/:filename
// @desc    Get customer document
// @access  Private (Customer/Admin)
router.get('/documents/:customerId/:filename', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        
        if (customer.customerId !== req.params.customerId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const document = customer.documents?.find(doc => 
            doc.filename === req.params.filename
        );

        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const filePath = path.join(__dirname, '..', document.path);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Document file not found'
            });
        }

        res.download(filePath, document.originalName);

    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch document'
        });
    }
});

// Admin routes for document management
// @route   GET /api/uploads/admin/documents/:customerId
// @desc    Get customer documents (Admin)
// @access  Private (Admin)
router.get('/admin/documents/:customerId', protect, async (req, res) => {
    try {
        const customer = await Customer.findOne({ customerId: req.params.customerId });
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        res.json({
            success: true,
            data: customer.documents || []
        });

    } catch (error) {
        console.error('Admin get documents error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch documents'
        });
    }
});

// @route   POST /api/uploads/admin/documents/:customerId
// @desc    Upload documents for customer (Admin)
// @access  Private (Admin)
router.post('/admin/documents/:customerId', protect, uploadDocument.array('documents', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const customer = await Customer.findOne({ customerId: req.params.customerId });
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }

        const uploadedDocuments = [];

        for (const file of req.files) {
            const document = {
                filename: file.filename,
                originalName: file.originalname,
                path: `/uploads/documents/${file.filename}`,
                size: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
                uploadedBy: 'admin',
                category: req.body.category || 'general',
                description: req.body.description || ''
            };

            uploadedDocuments.push(document);
        }

        // Add documents to customer record
        if (!customer.documents) {
            customer.documents = [];
        }
        customer.documents.push(...uploadedDocuments);
        await customer.save();

        res.json({
            success: true,
            message: `${uploadedDocuments.length} documents uploaded successfully`,
            data: uploadedDocuments
        });

    } catch (error) {
        console.error('Admin document upload error:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to upload documents'
        });
    }
});

module.exports = router;
