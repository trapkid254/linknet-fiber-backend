// routes/packages.js - Public Package Routes
const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const { optionalAuth } = require('../middleware/auth');

/**
 * @route   GET /api/packages
 * @desc    Get all active packages
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const { category, featured, active } = req.query;
        
        // Build query
        const query = { isActive: true };
        
        if (category) query.category = category;
        if (featured === 'true') query.featured = true;
        if (active === 'all') delete query.isActive;
        
        // Get packages
        const packages = await Package.find(query)
            .sort({ price: 1 })
            .select('-__v');
        
        res.json({
            success: true,
            count: packages.length,
            data: packages
        });
        
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch packages'
        });
    }
});

/**
 * @route   GET /api/packages/featured
 * @desc    Get featured packages
 * @access  Public
 */
router.get('/featured', async (req, res) => {
    try {
        const packages = await Package.find({ 
            isActive: true, 
            featured: true 
        })
        .limit(3)
        .select('-__v');
        
        res.json({
            success: true,
            data: packages
        });
        
    } catch (error) {
        console.error('Get featured packages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch featured packages'
        });
    }
});

/**
 * @route   GET /api/packages/:id
 * @desc    Get single package by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
    try {
        const pkg = await Package.findById(req.params.id).select('-__v');
        
        if (!pkg) {
            return res.status(404).json({
                success: false,
                error: 'Package not found'
            });
        }
        
        res.json({
            success: true,
            data: pkg
        });
        
    } catch (error) {
        console.error('Get package error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch package'
        });
    }
});

/**
 * @route   GET /api/packages/category/:category
 * @desc    Get packages by category
 * @access  Public
 */
router.get('/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        
        const packages = await Package.find({ 
            isActive: true, 
            category: category 
        }).select('-__v');
        
        res.json({
            success: true,
            data: packages
        });
        
    } catch (error) {
        console.error('Get packages by category error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch packages'
        });
    }
});

/**
 * @route   GET /api/packages/compare
 * @desc    Get packages for comparison
 * @access  Public
 */
router.get('/compare/featured', async (req, res) => {
    try {
        const packages = await Package.find({ isActive: true })
            .sort({ price: 1 })
            .limit(4)
            .select('name speed price features');
        
        res.json({
            success: true,
            data: packages
        });
        
    } catch (error) {
        console.error('Compare packages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch comparison data'
        });
    }
});

module.exports = router;