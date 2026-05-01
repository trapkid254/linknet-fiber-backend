// routes/content.js - Content/Statistics Routes
const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const { protect, authorize } = require('../middleware/auth');

// ─── GET /api/content - Get public content (no auth required) ─────────────────
router.get('/', async (req, res) => {
    try {
        const content = await Content.getContent();
        res.json({ success: true, data: content });
    } catch (error) {
        console.error('Get content error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch content' });
    }
});

// ─── GET /api/content/statistics - Get statistics only (public) ────────────────
router.get('/statistics', async (req, res) => {
    try {
        const content = await Content.getContent();
        res.json({ 
            success: true, 
            data: {
                yearsOfExperience: content.statistics.yearsOfExperience,
                projectsCompleted: content.statistics.projectsCompleted,
                satisfiedCustomers: content.statistics.satisfiedCustomers,
                coverageAreas: content.statistics.coverageAreas
            }
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// ─── PUT /api/content - Update content (admin only) ───────────────────────────
router.put('/', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const content = await Content.getContent();
        
        // Update fields
        if (req.body.statistics) {
            content.statistics = { ...content.statistics, ...req.body.statistics };
        }
        if (req.body.siteName) content.siteName = req.body.siteName;
        if (req.body.siteDescription) content.siteDescription = req.body.siteDescription;
        if (req.body.contactEmail) content.contactEmail = req.body.contactEmail;
        if (req.body.contactPhone) content.contactPhone = req.body.contactPhone;
        if (req.body.supportEmail) content.supportEmail = req.body.supportEmail;
        if (req.body.whatsappNumber) content.whatsappNumber = req.body.whatsappNumber;
        if (req.body.contactAddress) content.contactAddress = req.body.contactAddress;
        if (req.body.socialMedia) {
            content.socialMedia = { ...content.socialMedia, ...req.body.socialMedia };
        }
        if (req.body.businessHours) {
            content.businessHours = { ...content.businessHours, ...req.body.businessHours };
        }
        if (req.body.notifications) {
            content.notifications = { ...content.notifications, ...req.body.notifications };
        }
        if (req.body.maintenance) {
            content.maintenance = { ...content.maintenance, ...req.body.maintenance };
        }
        
        await content.save();
        
        res.json({ 
            success: true, 
            message: 'Content updated successfully',
            data: content
        });
    } catch (error) {
        console.error('Update content error:', error);
        res.status(500).json({ success: false, error: 'Failed to update content' });
    }
});

// ─── PUT /api/content/statistics - Update statistics only (admin) ─────────────
router.put('/statistics', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const content = await Content.getContent();
        
        // Update statistics
        if (req.body.yearsOfExperience !== undefined) {
            content.statistics.yearsOfExperience = req.body.yearsOfExperience;
        }
        if (req.body.projectsCompleted !== undefined) {
            content.statistics.projectsCompleted = req.body.projectsCompleted;
        }
        if (req.body.satisfiedCustomers !== undefined) {
            content.statistics.satisfiedCustomers = req.body.satisfiedCustomers;
        }
        if (req.body.coverageAreas !== undefined) {
            content.statistics.coverageAreas = req.body.coverageAreas;
        }
        
        await content.save();
        
        res.json({ 
            success: true, 
            message: 'Statistics updated successfully',
            data: content.statistics
        });
    } catch (error) {
        console.error('Update statistics error:', error);
        res.status(500).json({ success: false, error: 'Failed to update statistics' });
    }
});

module.exports = router;
