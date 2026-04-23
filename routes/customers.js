// backend/routes/customers.js - Customer Management Routes
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protectCustomer } = require('../middleware/auth');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// @route   POST /api/customers/register
// @desc    Register a new customer
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const {
            fullname,
            email,
            phone,
            idNumber,
            dateOfBirth,
            gender,
            county,
            estate,
            street,
            building,
            houseNumber,
            landmark,
            password,
            marketing
        } = req.body;

        // Validation
        if (!fullname || !email || !phone || !idNumber || !county || !estate || !street || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phone: phone },
                { idNumber: idNumber }
            ]
        });

        if (existingCustomer) {
            let field = 'account';
            if (existingCustomer.email === email.toLowerCase()) field = 'email';
            else if (existingCustomer.phone === phone) field = 'phone';
            else if (existingCustomer.idNumber === idNumber) field = 'ID number';

            return res.status(400).json({
                success: false,
                message: `Customer with this ${field} already exists`
            });
        }

        // Generate customer ID
        const customerId = 'CUST-' + Date.now().toString(36).toUpperCase();

        // Create new customer
        const customer = new Customer({
            customerId,
            fullname,
            email: email.toLowerCase(),
            phone,
            idNumber,
            dateOfBirth: dateOfBirth || null,
            gender: gender || null,
            address: {
                county,
                estate,
                street,
                building: building || null,
                houseNumber: houseNumber || null,
                landmark: landmark || null
            },
            communication: {
                email: true,
                sms: true,
                marketing: marketing || false
            },
            password
        });

        await customer.save();

        // Generate JWT token
        const token = jwt.sign(
            { customerId: customer.customerId, type: 'customer' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Customer registered successfully',
            token,
            customer: {
                customerId: customer.customerId,
                fullname: customer.fullname,
                email: customer.email,
                phone: customer.phone,
                accountStatus: customer.accountStatus
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

// @route   POST /api/customers/login
// @desc    Authenticate customer & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find customer by email
        const customer = await Customer.findOne({ email: email.toLowerCase() });

        if (!customer) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is active
        if (customer.accountStatus !== 'active') {
            return res.status(401).json({
                success: false,
                message: `Account is ${customer.accountStatus}. Please contact support.`
            });
        }

        // Check password
        const isMatch = await customer.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        customer.lastLogin = new Date();
        await customer.save();

        // Generate JWT token
        const token = jwt.sign(
            { customerId: customer.customerId, type: 'customer' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            customer: {
                customerId: customer.customerId,
                fullname: customer.fullname,
                email: customer.email,
                phone: customer.phone,
                accountStatus: customer.accountStatus,
                currentPackage: customer.currentPackage,
                activeServices: customer.activeServices.length,
                totalMonthlyCost: customer.totalMonthlyCost
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// @route   GET /api/customers/verify-token
// @desc    Verify customer token
// @access  Private
router.get('/verify-token', protectCustomer, async (req, res) => {
    try {
        // Customer is already attached by protectCustomer middleware
        const customer = req.customer;

        if (!customer) {
            return res.status(401).json({
                success: false,
                message: 'Customer not found'
            });
        }

        if (customer.accountStatus !== 'active') {
            return res.status(401).json({
                success: false,
                message: `Account is ${customer.accountStatus}`
            });
        }

        res.json({
            success: true,
            customer: {
                customerId: customer.customerId,
                fullname: customer.fullname,
                email: customer.email,
                phone: customer.phone,
                accountStatus: customer.accountStatus
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during token verification'
        });
    }
});

// @route   GET /api/customers/profile
// @desc    Get customer profile
// @access  Private
router.get('/profile', protectCustomer, async (req, res) => {
    try {
        // Customer is already attached by protectCustomer middleware
        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.json({
            success: true,
            customer: customer.toJSON()
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching profile'
        });
    }
});

// @route   PUT /api/customers/profile
// @desc    Update customer profile
// @access  Private
router.put('/profile', protectCustomer, async (req, res) => {
    try {
        const {
            fullname,
            phone,
            dateOfBirth,
            gender,
            county,
            estate,
            street,
            building,
            houseNumber,
            landmark,
            communication
        } = req.body;

        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Update fields
        if (fullname) customer.fullname = fullname;
        if (phone) customer.phone = phone;
        if (dateOfBirth) customer.dateOfBirth = dateOfBirth;
        if (gender) customer.gender = gender;
        
        if (county || estate || street) {
            customer.address = {
                ...customer.address,
                ...(county && { county }),
                ...(estate && { estate }),
                ...(street && { street }),
                ...(building && { building }),
                ...(houseNumber && { houseNumber }),
                ...(landmark && { landmark })
            };
        }

        if (communication) {
            customer.communication = {
                ...customer.communication,
                ...communication
            };
        }

        await customer.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            customer: customer.toJSON()
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating profile'
        });
    }
});

// @route   PUT /api/customers/password
// @desc    Change customer password
// @access  Private
router.put('/password', protectCustomer, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Verify current password
        const isMatch = await customer.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        customer.password = newPassword;
        await customer.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error changing password'
        });
    }
});

// @route   GET /api/customers/services
// @desc    Get customer services
// @access  Private
router.get('/services', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.json({
            success: true,
            services: customer.services,
            activeServices: customer.activeServices,
            currentPackage: customer.currentPackage
        });

    } catch (error) {
        console.error('Services fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching services'
        });
    }
});

// @route   GET /api/customers/billing
// @desc    Get customer billing information
// @access  Private
router.get('/billing', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.json({
            success: true,
            billing: {
                paymentMethods: customer.paymentMethods,
                billingCycle: customer.billingCycle,
                outstandingBalance: customer.outstandingBalance,
                creditLimit: customer.creditLimit,
                totalMonthlyCost: customer.totalMonthlyCost,
                lastPaymentDate: customer.lastPaymentDate
            }
        });

    } catch (error) {
        console.error('Billing fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching billing information'
        });
    }
});

// @route   POST /api/customers/support-ticket
// @desc    Create support ticket
// @access  Private
router.post('/support-ticket', protectCustomer, async (req, res) => {
    try {
        const { category, subject, description, priority } = req.body;

        if (!category || !subject || !description) {
            return res.status(400).json({
                success: false,
                message: 'Please provide category, subject, and description'
            });
        }

        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const ticket = {
            ticketId: 'TKT-' + Date.now().toString(36).toUpperCase(),
            category,
            subject,
            description,
            priority: priority || 'medium',
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        customer.supportTickets.push(ticket);
        await customer.save();

        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully',
            ticket
        });

    } catch (error) {
        console.error('Support ticket creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating support ticket'
        });
    }
});

// @route   GET /api/customers/support-tickets
// @desc    Get customer support tickets
// @access  Private
router.get('/support-tickets', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.json({
            success: true,
            tickets: customer.supportTickets.sort((a, b) => b.createdAt - a.createdAt)
        });

    } catch (error) {
        console.error('Support tickets fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching support tickets'
        });
    }
});

// @route   POST /api/customers/logout
// @desc    Logout customer (client-side token removal)
// @access  Private
router.post('/logout', protectCustomer, (req, res) => {
    res.json({
        success: true,
        message: 'Logout successful'
    });
});

module.exports = router;
