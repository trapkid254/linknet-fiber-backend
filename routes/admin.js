// routes/admin.js - Admin Routes
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Request = require('../models/Request');
const Package = require('../models/Package');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'linknet-admin-secret-2024';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'administrator@linknetfiber.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Linknet@2024';

// ─── Auth middleware (local, for admin routes only) ───────────────────────────
const requireAdminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
};

// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        // Find admin by email
        const admin = await Admin.findOne({ email });
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
        const isPasswordValid = await admin.comparePassword(password);
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

// ─── GET /api/admin/verify ────────────────────────────────────────────────────
router.get('/verify', requireAdminAuth, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// ─── GET /api/admin/dashboard/stats ──────────────────────────────────────────
router.get('/dashboard/stats', requireAdminAuth, async (req, res) => {
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
router.get('/requests', requireAdminAuth, async (req, res) => {
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
router.put('/requests/:id', requireAdminAuth, async (req, res) => {
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
router.delete('/requests/:id', requireAdminAuth, async (req, res) => {
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
router.get('/packages', requireAdminAuth, async (req, res) => {
    try {
        const packages = await Package.find().sort({ price: 1 });
        res.json({ success: true, count: packages.length, data: packages });
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch packages' });
    }
});

// ─── POST /api/admin/packages ─────────────────────────────────────────────────
router.post('/packages', requireAdminAuth, async (req, res) => {
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
router.put('/packages/:id', requireAdminAuth, async (req, res) => {
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
router.delete('/packages/:id', requireAdminAuth, async (req, res) => {
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

module.exports = router;
