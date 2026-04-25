// routes/clients.js - Client Routes
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Client = require('../models/Client');

const JWT_SECRET = process.env.JWT_SECRET || 'linknet-client-secret-2024';

// ─── POST /api/clients/register ────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, mpesaNumber } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !password || !phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'All required fields must be provided' 
            });
        }

        // Check if client already exists
        const existingClient = await Client.findOne({ email });
        if (existingClient) {
            return res.status(409).json({ 
                success: false, 
                error: 'Email already registered' 
            });
        }

        // Create new client
        const client = new Client({
            firstName,
            lastName,
            email,
            password,
            phone,
            mpesaNumber: mpesaNumber || phone
        });

        await client.save();

        // Generate JWT token
        const token = jwt.sign(
            {
                id: client._id,
                email: client.email,
                firstName: client.firstName,
                lastName: client.lastName,
                role: 'client'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            client: {
                id: client._id,
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                phone: client.phone,
                mpesaNumber: client.mpesaNumber
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Registration failed. Please try again.' 
        });
    }
});

// ─── POST /api/clients/login ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email and password are required' 
            });
        }

        // Find client by email
        const client = await Client.findOne({ email });
        
        if (!client) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }

        // Check if account is locked
        if (client.isLocked()) {
            return res.status(423).json({ 
                success: false, 
                error: 'Account temporarily locked due to multiple failed attempts' 
            });
        }

        // Check if account is active
        if (client.status !== 'active') {
            return res.status(403).json({ 
                success: false, 
                error: 'Account is not active' 
            });
        }

        // Verify password
        const isPasswordValid = await client.comparePassword(password);
        
        if (!isPasswordValid) {
            await client.incrementLoginAttempts();
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }

        // Reset login attempts on successful login
        await client.resetLoginAttempts();

        // Generate JWT token
        const token = jwt.sign(
            {
                id: client._id,
                email: client.email,
                firstName: client.firstName,
                lastName: client.lastName,
                role: 'client'
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            client: {
                id: client._id,
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                phone: client.phone,
                mpesaNumber: client.mpesaNumber,
                package: client.package,
                installationStatus: client.installationStatus
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Login failed. Please try again.' 
        });
    }
});

// ─── GET /api/clients/profile ────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'No token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await Client.findById(decoded.id).populate('package');
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }

        return res.json({
            success: true,
            client
        });
    } catch (error) {
        console.error('Profile error:', error);
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired token' 
        });
    }
});

// ─── PUT /api/clients/profile ────────────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'No token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await Client.findById(decoded.id);
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }

        // Update allowed fields
        const allowedFields = ['firstName', 'lastName', 'phone', 'mpesaNumber', 'installationAddress'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                client[field] = req.body[field];
            }
        });

        await client.save();

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            client
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to update profile' 
        });
    }
});

// ─── GET /api/clients/activity ────────────────────────────────────────────────────────
router.get('/activity', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'No token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await Client.findById(decoded.id);
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }

        // Return mock activity data for now
        // In production, this would query an Activity collection
        const activities = [
            {
                type: 'payment',
                title: 'Payment Received',
                description: 'Monthly payment for fiber service',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                type: 'installation',
                title: 'Installation Completed',
                description: 'Fiber installation at your location',
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        ];

        return res.json({
            success: true,
            activities
        });
    } catch (error) {
        console.error('Activity error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch activity' 
        });
    }
});

// ─── GET /api/clients/requests ────────────────────────────────────────────────────────
router.get('/requests', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'No token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await Client.findById(decoded.id);
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }

        // Fetch requests for this client
        const Request = require('../models/Request');
        const requests = await Request.find({ email: client.email })
            .populate('packageId', 'name speed price')
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('Client requests error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch requests' 
        });
    }
});

// ─── GET /api/clients/billing ────────────────────────────────────────────────────────
router.get('/billing', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'No token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        const client = await Client.findById(decoded.id).populate('package');
        
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                error: 'Client not found' 
            });
        }

        // Return billing information
        const billing = {
            currentBill: client.package ? client.package.price : 0,
            nextBillingDate: client.nextBillingDate || null,
            paymentHistory: [
                {
                    invoiceNumber: 'INV-2024-001',
                    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    amount: client.package ? client.package.price : 0,
                    status: 'paid'
                }
            ],
            outstandingBalance: 0
        };

        return res.json({
            success: true,
            billing
        });
    } catch (error) {
        console.error('Billing error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch billing information' 
        });
    }
});

module.exports = router;
