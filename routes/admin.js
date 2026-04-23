// routes/admin.js - Admin Routes - v2
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Request = require('../models/Request');
const Package = require('../models/Package');
const Admin = require('../models/Admin');
const Coverage = require('../models/Coverage');
const Customer = require('../models/Customer');
const { protect, authorize } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'linknet-admin-secret-2024';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'administrator@linknetfiber.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Linknet@2024';


// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        // Find admin by email
        let admin = await Admin.findOne({ email });
        
        // Fallback: Check default admin credentials if no admin in database
        if (!admin && email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            // Create default admin on-the-fly
            try {
                const bcrypt = require('bcryptjs');
                const defaultAdmin = new Admin({
                    name: 'System Administrator',
                    email: ADMIN_EMAIL,
                    password: await bcrypt.hash(ADMIN_PASSWORD, 10),
                    role: 'admin',
                    status: 'active',
                    permissions: ['manage_packages', 'manage_requests', 'manage_admins', 'view_analytics', 'manage_coverage', 'manage_settings']
                });
                await defaultAdmin.save();
                admin = defaultAdmin;
            } catch (err) {
                console.error('Error creating default admin:', err);
            }
        }
        
        if (!admin) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Check if account is locked
        if (admin.isLocked()) {
            return res.status(423).json({ success: false, error: 'Account temporarily locked due to multiple failed attempts' });
        }

        // Check if account is active
        if (admin.status !== 'active') {
            return res.status(403).json({ success: false, error: 'Account is not active' });
        }

        // Verify password
        let isPasswordValid = await admin.comparePassword(password);
        
        // Fallback: Direct password check for default admin
        if (!isPasswordValid && email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            isPasswordValid = true;
        }
        
        if (!isPasswordValid) {
            await admin.incrementLoginAttempts();
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Reset login attempts on successful login
        await admin.resetLoginAttempts();

        const token = jwt.sign(
            {
                id: admin._id,
                email: admin.email,
                name: admin.name,
                role: admin.role
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                permissions: admin.allPermissions
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

// ─── POST /api/admin/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// ─── GET /api/admin/test ──────────────────────────────────────────────────────
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Admin routes working', timestamp: new Date().toISOString() });
});

// Test endpoint with protect middleware only
router.get('/test-auth', protect, (req, res) => {
    res.json({ success: true, message: 'Protect middleware working', admin: req.admin ? req.admin.email : 'No admin' });
});

// ─── GET /api/admin/verify ────────────────────────────────────────────────────
router.get('/verify', protect, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// ─── GET /api/admin/dashboard/stats ──────────────────────────────────────────
router.get('/dashboard/stats', protect, async (req, res) => {
    try {
        const [
            totalRequests,
            pendingRequests,
            approvedRequests,
            rejectedRequests,
            activePackages,
            recentRequests
        ] = await Promise.all([
            Request.countDocuments(),
            Request.countDocuments({ status: 'pending' }),
            Request.countDocuments({ status: 'approved' }),
            Request.countDocuments({ status: 'rejected' }),
            Package.countDocuments({ isActive: true }),
            Request.find().sort({ createdAt: -1 }).limit(10).populate('packageId', 'name price')
        ]);

        // Estimate revenue from approved requests
        const approvedWithPackages = await Request.find({ status: 'approved' }).populate('packageId', 'price');
        const totalRevenue = approvedWithPackages.reduce((sum, r) => {
            return sum + (r.packageId?.price || 0);
        }, 0);

        res.json({
            success: true,
            stats: {
                requests: {
                    total: totalRequests,
                    pending: pendingRequests,
                    approved: approvedRequests,
                    rejected: rejectedRequests
                },
                packages: {
                    active: activePackages
                },
                revenue: {
                    total: totalRevenue
                },
                recentRequests
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to load dashboard stats' });
    }
});

// ─── GET /api/admin/requests ──────────────────────────────────────────────────
router.get('/requests', protect, async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const query = status ? { status } : {};

        const requests = await Request.find(query)
            .populate('packageId', 'name price speed')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Request.countDocuments(query);

        res.json({
            success: true,
            count: requests.length,
            total,
            page: parseInt(page),
            data: requests
        });

    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch requests' });
    }
});

// ─── PUT /api/admin/requests/:id ─────────────────────────────────────────────
router.put('/requests/:id', protect, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const validStatuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status value' });
        }

        const update = {};
        if (status) update.status = status;
        if (notes) update.notes = notes;

        const request = await Request.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true, runValidators: true }
        ).populate('packageId', 'name price');

        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }

        res.json({ success: true, data: request });

    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({ success: false, error: 'Failed to update request' });
    }
});

// ─── DELETE /api/admin/requests/:id ──────────────────────────────────────────
router.delete('/requests/:id', protect, async (req, res) => {
    try {
        const request = await Request.findByIdAndDelete(req.params.id);
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        res.json({ success: true, message: 'Request deleted successfully' });
    } catch (error) {
        console.error('Delete request error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete request' });
    }
});

// ─── GET /api/admin/packages ──────────────────────────────────────────────────
router.get('/packages', async (req, res) => {
    try {
        const packages = await Package.find().sort({ price: 1 });
        res.json({ success: true, count: packages.length, data: packages });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch packages' });
    }
});

// Get single package by ID
router.get('/packages/:id', async (req, res) => {
    try {
        const package = await Package.findById(req.params.id);
        
        if (!package) {
            return res.status(404).json({ success: false, error: 'Package not found' });
        }
        
        res.json({ success: true, data: package });
    } catch (error) {
        console.error('Get package error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch package' });
    }
});

// Get current admin profile
router.get('/profile', protect, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id).select('-password');
        
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }
        
        res.json({ 
            success: true, 
            data: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                status: admin.status,
                permissions: admin.allPermissions,
                profileImage: admin.profileImage,
                phone: admin.phone,
                createdAt: admin.createdAt,
                lastLogin: admin.lastLogin
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
});

// Update admin profile
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email, phone, permissions } = req.body;
        
        // Find admin
        const admin = await Admin.findById(req.admin.id);
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }
        
        // Update fields
        if (name) admin.name = name;
        if (email) {
            // Check if email is already taken by another admin
            const existingAdmin = await Admin.findOne({ 
                email, 
                _id: { $ne: admin._id } 
            });
            if (existingAdmin) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Email is already in use' 
                });
            }
            admin.email = email;
        }
        if (phone) admin.phone = phone;
        if (permissions && Array.isArray(permissions)) {
            admin.permissions = permissions;
        }
        
        await admin.save();
        
        // Return updated profile without password
        const updatedAdmin = await Admin.findById(admin._id).select('-password');
        
        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            data: {
                id: updatedAdmin._id,
                name: updatedAdmin.name,
                email: updatedAdmin.email,
                role: updatedAdmin.role,
                status: updatedAdmin.status,
                permissions: updatedAdmin.allPermissions,
                profileImage: updatedAdmin.profileImage,
                phone: updatedAdmin.phone,
                createdAt: updatedAdmin.createdAt,
                lastLogin: updatedAdmin.lastLogin
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// Upload profile image
router.post('/profile/image', protect, async (req, res) => {
    try {
        // For now, we'll handle base64 image upload
        // In production, you might want to use multer for file uploads
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ 
                success: false, 
                error: 'No image data provided' 
            });
        }
        
        // Validate base64 image
        if (!imageData.startsWith('data:image/')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid image format' 
            });
        }
        
        // Find admin
        const admin = await Admin.findById(req.admin.id);
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }
        
        // Update profile image
        admin.profileImage = imageData;
        await admin.save();
        
        res.json({ 
            success: true, 
            message: 'Profile image updated successfully',
            data: { profileImage: imageData }
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({ success: false, error: 'Failed to upload image' });
    }
});

// Change password
router.post('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Current password and new password are required' 
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: 'New password must be at least 6 characters long' 
            });
        }
        
        // Find admin
        const admin = await Admin.findById(req.admin.id);
        if (!admin) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }
        
        // Verify current password
        const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ 
                success: false, 
                error: 'Current password is incorrect' 
            });
        }
        
        // Update password
        admin.password = newPassword;
        await admin.save();
        
        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
});

// Get system settings
router.get('/settings', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        // For now, return default settings
        // In production, you might want to store these in a database
        const settings = {
            siteName: 'Linknet Fiber',
            siteDescription: 'Kenya\'s Most Reliable Fiber Network',
            contactEmail: 'info@linknetfiber.com',
            contactPhone: '+254 708 860 451',
            supportEmail: 'support@linknetfiber.com',
            whatsappNumber: '+254708860451',
            socialMedia: {
                facebook: 'https://facebook.com/linknetfiber',
                twitter: 'https://twitter.com/linknetfiber',
                instagram: 'https://instagram.com/linknetfiber',
                linkedin: 'https://linkedin.com/company/linknetfiber'
            },
            businessHours: {
                weekdays: '8:00 AM - 6:00 PM',
                saturday: '9:00 AM - 4:00 PM',
                sunday: 'Closed'
            },
            maintenance: {
                enabled: false,
                message: ''
            },
            notifications: {
                emailNotifications: true,
                smsNotifications: false,
                newRequestAlert: true,
                monthlyReports: true
            }
        };
        
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

// Update system settings
router.put('/settings', protect, authorize('super_admin'), async (req, res) => {
    try {
        const settings = req.body;
        
        // Validate required fields
        if (!settings.siteName || !settings.contactEmail) {
            return res.status(400).json({ 
                success: false, 
                error: 'Site name and contact email are required' 
            });
        }
        
        // For now, just return success
        // In production, you would save these to a database
        res.json({ 
            success: true, 
            message: 'Settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

// ─── POST /api/admin/packages ─────────────────────────────────────────────────
router.post('/packages', protect, async (req, res) => {
    try {
        const pkg = new Package(req.body);
        await pkg.save();
        res.status(201).json({ success: true, data: pkg });
    } catch (error) {
        console.error('Create package error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ─── PUT /api/admin/packages/:id ─────────────────────────────────────────────
router.put('/packages/:id', protect, async (req, res) => {
    try {
        const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!pkg) {
            return res.status(404).json({ success: false, error: 'Package not found' });
        }
        res.json({ success: true, data: pkg });
    } catch (error) {
        console.error('Update package error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ─── DELETE /api/admin/packages/:id ──────────────────────────────────────────
router.delete('/packages/:id', protect, async (req, res) => {
    try {
        const pkg = await Package.findByIdAndDelete(req.params.id);
        if (!pkg) {
            return res.status(404).json({ success: false, error: 'Package not found' });
        }
        res.json({ success: true, message: 'Package deleted successfully' });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete package' });
    }
});

// ─── GET /api/admin/coverage ───────────────────────────────────────────────────
router.get('/coverage', protect, async (req, res) => {
    try {
        const coverage = await Coverage.find().sort({ city: 1, estate: 1 });
        res.json({ success: true, count: coverage.length, data: coverage });
    } catch (error) {
        console.error('Get coverage error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch coverage areas' });
    }
});

// ─── POST /api/admin/coverage ──────────────────────────────────────────────────
router.post('/coverage', protect, async (req, res) => {
    try {
        const coverage = new Coverage(req.body);
        await coverage.save();
        res.status(201).json({ success: true, data: coverage });
    } catch (error) {
        console.error('Create coverage error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ─── PUT /api/admin/coverage/:id ─────────────────────────────────────────────────
router.put('/coverage/:id', protect, async (req, res) => {
    try {
        const coverage = await Coverage.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!coverage) {
            return res.status(404).json({ success: false, error: 'Coverage area not found' });
        }
        res.json({ success: true, data: coverage });
    } catch (error) {
        console.error('Update coverage error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ─── DELETE /api/admin/coverage/:id ───────────────────────────────────────────────
router.delete('/coverage/:id', protect, async (req, res) => {
    try {
        const coverage = await Coverage.findByIdAndDelete(req.params.id);
        if (!coverage) {
            return res.status(404).json({ success: false, error: 'Coverage area not found' });
        }
        res.json({ success: true, message: 'Coverage area deleted successfully' });
    } catch (error) {
        console.error('Delete coverage error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete coverage area' });
    }
});

// Public coverage search endpoint (no auth required)
router.get('/public/coverage/search', async (req, res) => {
    try {
        const { county, estate } = req.query;
        
        if (!county || !estate) {
            return res.status(400).json({
                success: false,
                error: 'County and estate parameters are required'
            });
        }
        
        // Search for coverage areas
        const coverage = await Coverage.find({
            $or: [
                { county: { $regex: county, $options: 'i' } },
                { city: { $regex: county, $options: 'i' } }
            ],
            status: 'available'
        });
        
        // Check if estate matches any coverage areas
        const isAvailable = coverage.some(area => {
            const estateLower = estate.toLowerCase();
            const cityMatch = area.city && area.city.toLowerCase().includes(estateLower);
            const estateMatch = area.estate && area.estate.toLowerCase().includes(estateLower);
            const countyMatch = area.county && area.county.toLowerCase().includes(estateLower);
            
            return cityMatch || estateMatch || countyMatch;
        });
        
        // Get all available counties for dropdown
        const allCoverage = await Coverage.find({ status: 'available' }).distinct('county');
        const cities = await Coverage.find({ status: 'available' }).distinct('city');
        
        res.json({
            success: true,
            isAvailable,
            coverage: coverage.map(area => ({
                city: area.city,
                estate: area.estate,
                county: area.county,
                status: area.status
            })),
            availableCounties: [...new Set([...allCoverage, ...cities])].sort()
        });
        
    } catch (error) {
        console.error('Coverage search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search coverage areas'
        });
    }
});

// Public coverage areas endpoint (no auth required)
router.get('/public/coverage', async (req, res) => {
    try {
        const coverage = await Coverage.find({ status: 'available' })
            .sort({ county: 1, city: 1, estate: 1 });
        
        // Group by county/city
        const groupedCoverage = {};
        coverage.forEach(area => {
            const key = area.county || area.city;
            if (!groupedCoverage[key]) {
                groupedCoverage[key] = [];
            }
            if (area.estate) {
                groupedCoverage[key].push(area.estate);
            }
        });
        
        res.json({
            success: true,
            coverage: Object.keys(groupedCoverage).sort().map(county => ({
                county,
                estates: [...new Set(groupedCoverage[county])].sort()
            }))
        });
        
    } catch (error) {
        console.error('Get coverage error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch coverage areas'
        });
    }
});

// Get all customers for admin
router.get('/customers/all', protect, authorize('admin'), async (req, res) => {
    try {
        const customers = await Customer.find()
            .select('-password')
            .sort({ registrationDate: -1 });
        
        res.json({
            success: true,
            customers: customers.map(customer => customer.toJSON())
        });
        
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customers'
        });
    }
});

// Get single customer for admin
router.get('/customers/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id).select('-password');
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        
        res.json({
            success: true,
            customer: customer.toJSON()
        });
        
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch customer'
        });
    }
});

// Update customer for admin
router.put('/customers/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { fullname, email, phone, accountStatus, address } = req.body;
        
        const customer = await Customer.findById(req.params.id);
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        
        // Update fields
        if (fullname) customer.fullname = fullname;
        if (email) customer.email = email.toLowerCase();
        if (phone) customer.phone = phone;
        if (accountStatus) customer.accountStatus = accountStatus;
        if (address) {
            customer.address = { ...customer.address, ...address };
        }
        
        await customer.save();
        
        res.json({
            success: true,
            message: 'Customer updated successfully',
            customer: customer.toJSON()
        });
        
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update customer'
        });
    }
});

// Delete customer for admin
router.delete('/customers/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        
        await Customer.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Customer deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete customer'
        });
    }
});

module.exports = router;
