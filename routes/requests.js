// routes/requests.js - Public Installation Request Routes
const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const Package = require('../models/Package');
const { optionalAuth } = require('../middleware/auth');

/**
 * @route   POST /api/requests
 * @desc    Submit installation request
 * @access  Public
 */
router.post('/', async (req, res) => {
    try {
        const {
            fullname,
            email,
            phone,
            idNumber,
            county,
            estate,
            street,
            building,
            houseNumber,
            landmark,
            packageId,
            billingCycle,
            preferredDate,
            preferredTime,
            terms,
            marketing
        } = req.body;
        
        // Validate required fields
        if (!fullname || !email || !phone || !county || !estate || !street || !packageId || !preferredDate || !preferredTime) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }
        
        // Validate terms acceptance
        if (!terms) {
            return res.status(400).json({
                success: false,
                error: 'You must accept the terms and conditions'
            });
        }
        
        // Check if package exists and is active
        const pkg = await Package.findById(packageId);
        if (!pkg || !pkg.isActive) {
            return res.status(400).json({
                success: false,
                error: 'Selected package is not available'
            });
        }
        
        // Check for duplicate pending request
        const existingRequest = await Request.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phone: phone }
            ],
            status: { $in: ['pending', 'approved', 'scheduled', 'in_progress'] }
        });
        
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                error: 'You already have a pending installation request',
                requestId: existingRequest.requestId
            });
        }
        
        // Create request
        const request = await Request.create({
            fullname,
            email: email.toLowerCase(),
            phone,
            idNumber,
            county,
            estate,
            street,
            building,
            houseNumber,
            landmark,
            packageId,
            billingCycle,
            preferredDate: new Date(preferredDate),
            preferredTime,
            terms,
            marketing,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            source: 'website'
        });
        
        // Populate package details for response
        await request.populate('packageId', 'name speed price');
        
        res.status(201).json({
            success: true,
            message: 'Installation request submitted successfully',
            data: {
                requestId: request.requestId,
                status: request.status,
                package: request.packageId,
                preferredDate: request.preferredDate,
                preferredTime: request.preferredTime
            }
        });
        
    } catch (error) {
        console.error('Submit request error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to submit installation request'
        });
    }
});

/**
 * @route   GET /api/requests/check/:requestId
 * @desc    Check request status by ID
 * @access  Public
 */
router.get('/check/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const request = await Request.findOne({ requestId })
            .populate('packageId', 'name speed price')
            .select('-__v -ipAddress -userAgent');
        
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                requestId: request.requestId,
                status: request.status,
                statusDisplay: request.statusDisplay,
                fullname: request.fullname,
                package: request.packageId,
                preferredDate: request.preferredDate,
                preferredTime: request.preferredTime,
                scheduledDate: request.scheduledDate,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt
            }
        });
        
    } catch (error) {
        console.error('Check request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check request status'
        });
    }
});

/**
 * @route   GET /api/requests/check/email/:email
 * @desc    Check requests by email
 * @access  Public
 */
router.get('/check/email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        const requests = await Request.find({ email: email.toLowerCase() })
            .populate('packageId', 'name speed price')
            .sort({ createdAt: -1 })
            .select('-__v');
        
        if (!requests.length) {
            return res.status(404).json({
                success: false,
                error: 'No requests found for this email'
            });
        }
        
        res.json({
            success: true,
            count: requests.length,
            data: requests.map(r => ({
                requestId: r.requestId,
                status: r.status,
                statusDisplay: r.statusDisplay,
                package: r.packageId,
                createdAt: r.createdAt
            }))
        });
        
    } catch (error) {
        console.error('Check requests by email error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch requests'
        });
    }
});

/**
 * @route   POST /api/requests/contact
 * @desc    Submit contact form
 * @access  Public
 */
router.post('/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, package: packageId, message, consent } = req.body;
        
        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please provide all required fields'
            });
        }
        
        // Validate consent
        if (!consent) {
            return res.status(400).json({
                success: false,
                error: 'You must consent to receive communications'
            });
        }
        
        // Here you would typically:
        // 1. Save to a Contact collection
        // 2. Send email notification
        // 3. Create a support ticket
        
        // For now, just log and return success
        console.log('Contact form submission:', {
            name,
            email,
            phone,
            subject,
            packageId,
            message,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'Your message has been received. We will respond within 1 hour.'
        });
        
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit contact form'
        });
    }
});

/**
 * @route   GET /api/requests/coverage/check
 * @desc    Check coverage for a location
 * @access  Public
 */
router.get('/coverage/check', (req, res) => {
    const { county, estate } = req.query;
    
    if (!county || !estate) {
        return res.status(400).json({
            success: false,
            error: 'County and estate are required'
        });
    }
    
    // Coverage data (same as frontend)
    const coverageData = {
        nairobi: ['Westlands', 'Kilimani', 'Karen', 'Lavington', 'Kileleshwa', 'Parklands', 'Upper Hill', 'CBD'],
        mombasa: ['Nyali', 'Bamburi', 'Diani', 'Mtwapa', 'Old Town', 'Kizingo'],
        kisumu: ['Milimani', 'Kibuye', 'Mamboleo', 'Kanyakwar', 'Nyalenda'],
        nakuru: ['Milimani', 'Section 58', 'Lanet', 'Njoro', 'London'],
        kericho: ['Kapsoya', 'Kipkelion', 'Ainamoi', 'Soin', 'Belgut'],
        kiambu: ['Juja', 'Kenyatta road', 'Juja Farm', 'Ruiru', 'Thika', 'Githurai'],
    };
    
    const countyLower = county.toLowerCase();
    const estateLower = estate.toLowerCase();
    
    let available = false;
    let areas = [];
    
    if (coverageData[countyLower]) {
        areas = coverageData[countyLower];
        available = areas.some(area => 
            area.toLowerCase().includes(estateLower) || 
            estateLower.includes(area.toLowerCase())
        );
    }
    
    res.json({
        success: true,
        data: {
            county,
            estate,
            available,
            coveredAreas: available ? areas : [],
            message: available 
                ? `Great news! Linknet Fiber is available in ${estate}, ${county}.`
                : `Coming soon! We're expanding to ${county} soon.`
        }
    });
});

module.exports = router;