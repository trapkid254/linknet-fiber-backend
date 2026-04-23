// backend/routes/billing.js - Billing and Payment Routes
const express = require('express');
const router = express.Router();
const { protectCustomer, protect } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Package = require('../models/Package');

// @route   GET /api/billing/invoices
// @desc    Get customer invoices
// @access  Private (Customer)
router.get('/invoices', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        
        // Generate mock invoices for demo
        const invoices = [
            {
                invoiceId: 'INV-' + Date.now().toString(36).toUpperCase(),
                date: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                amount: customer.totalMonthlyCost || 0,
                status: 'pending',
                description: 'Monthly subscription',
                items: [
                    {
                        name: customer.currentPackage || 'Basic Package',
                        quantity: 1,
                        price: customer.totalMonthlyCost || 0
                    }
                ]
            }
        ];

        res.json({
            success: true,
            invoices
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices'
        });
    }
});

// @route   GET /api/billing/payment-methods
// @desc    Get customer payment methods
// @access  Private (Customer)
router.get('/payment-methods', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        
        res.json({
            success: true,
            paymentMethods: customer.paymentMethods || []
        });
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment methods'
        });
    }
});

// @route   POST /api/billing/payment-methods
// @desc    Add payment method
// @access  Private (Customer)
router.post('/payment-methods', protectCustomer, async (req, res) => {
    try {
        const { type, last4, expiry, brand, isDefault } = req.body;
        const customer = req.customer;

        const paymentMethod = {
            id: 'PM-' + Date.now().toString(36).toUpperCase(),
            type,
            last4,
            expiry,
            brand,
            isDefault: isDefault || false,
            createdAt: new Date()
        };

        if (isDefault) {
            // Set all other methods to non-default
            customer.paymentMethods.forEach(method => {
                method.isDefault = false;
            });
        }

        customer.paymentMethods.push(paymentMethod);
        await customer.save();

        res.json({
            success: true,
            message: 'Payment method added successfully',
            paymentMethod
        });
    } catch (error) {
        console.error('Error adding payment method:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add payment method'
        });
    }
});

// @route   DELETE /api/billing/payment-methods/:id
// @desc    Remove payment method
// @access  Private (Customer)
router.delete('/payment-methods/:id', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;
        const methodId = req.params.id;

        customer.paymentMethods = customer.paymentMethods.filter(
            method => method.id !== methodId
        );

        await customer.save();

        res.json({
            success: true,
            message: 'Payment method removed successfully'
        });
    } catch (error) {
        console.error('Error removing payment method:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove payment method'
        });
    }
});

// @route   POST /api/billing/pay
// @desc    Process payment
// @access  Private (Customer)
router.post('/pay', protectCustomer, async (req, res) => {
    try {
        const { invoiceId, paymentMethodId, amount } = req.body;
        const customer = req.customer;

        // Mock payment processing
        const payment = {
            paymentId: 'PAY-' + Date.now().toString(36).toUpperCase(),
            invoiceId,
            amount,
            status: 'completed',
            paymentMethodId,
            processedAt: new Date()
        };

        // Update customer's last payment date
        customer.lastPaymentDate = new Date();
        customer.outstandingBalance = Math.max(0, (customer.outstandingBalance || 0) - amount);
        await customer.save();

        res.json({
            success: true,
            message: 'Payment processed successfully',
            payment
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process payment'
        });
    }
});

// @route   GET /api/billing/usage
// @desc    Get customer usage statistics
// @access  Private (Customer)
router.get('/usage', protectCustomer, async (req, res) => {
    try {
        const customer = req.customer;

        // Mock usage data
        const usage = {
            currentPeriod: {
                dataUsed: '250 GB',
                dataLimit: '500 GB',
                percentage: 50,
                daysRemaining: 15
            },
            history: [
                { month: 'Jan 2024', usage: '320 GB', limit: '500 GB' },
                { month: 'Feb 2024', usage: '280 GB', limit: '500 GB' },
                { month: 'Mar 2024', usage: '410 GB', limit: '500 GB' }
            ]
        };

        res.json({
            success: true,
            usage
        });
    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch usage data'
        });
    }
});

// @route   GET /api/admin/billing/summary
// @desc    Get billing summary for admin
// @access  Private (Admin)
router.get('/summary', protect, async (req, res) => {
    try {
        const customers = await Customer.find();
        
        const summary = {
            totalRevenue: customers.reduce((sum, customer) => sum + (customer.totalMonthlyCost || 0), 0),
            totalCustomers: customers.length,
            activeCustomers: customers.filter(c => c.accountStatus === 'active').length,
            outstandingBalance: customers.reduce((sum, customer) => sum + (customer.outstandingBalance || 0), 0),
            monthlyRevenue: customers.filter(c => c.accountStatus === 'active')
                .reduce((sum, customer) => sum + (customer.totalMonthlyCost || 0), 0)
        };

        res.json({
            success: true,
            summary
        });
    } catch (error) {
        console.error('Error fetching billing summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch billing summary'
        });
    }
});

module.exports = router;
