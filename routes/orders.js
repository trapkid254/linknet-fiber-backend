// routes/orders.js - Orders Routes
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');

// ─── GET /api/orders - Get all orders (admin only) ───────────────────────────
router.get('/', protect, authorize('admin', 'super_admin', 'support', 'sales'), async (req, res) => {
    try {
        const { status, paymentStatus } = req.query;
        const filter = {};
        
        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        
        const orders = await Order.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Error fetching orders' });
    }
});

// ─── GET /api/orders/:id - Get single order (admin only) ───────────────────────
router.get('/:id', protect, authorize('admin', 'super_admin', 'support', 'sales'), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ success: false, error: 'Error fetching order' });
    }
});

// ─── POST /api/orders - Create order (public) ───────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { items, customerName, customerPhone, total, deliveryFee, paymentMethod, paymentPhone } = req.body;
        
        // Generate order number
        const orderNumber = `LNK-${Date.now().toString().slice(-6)}`;
        
        const order = await Order.create({
            orderNumber,
            items,
            customerName,
            customerPhone,
            total,
            deliveryFee,
            paymentMethod,
            paymentPhone,
            status: 'pending',
            paymentStatus: 'pending'
        });
        
        res.status(201).json({ success: true, order });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, error: 'Error creating order' });
    }
});

// ─── PUT /api/orders/:id/status - Update order status (admin only) ─────────────
router.put('/:id/status', protect, authorize('admin', 'super_admin', 'support', 'sales'), async (req, res) => {
    try {
        const { status } = req.body;
        
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, error: 'Error updating order status' });
    }
});

// ─── PUT /api/orders/:id/payment-status - Update payment status (admin only) ────
router.put('/:id/payment-status', protect, authorize('admin', 'super_admin', 'support', 'sales'), async (req, res) => {
    try {
        const { paymentStatus } = req.body;
        
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { paymentStatus },
            { new: true, runValidators: true }
        );
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ success: false, error: 'Error updating payment status' });
    }
});

module.exports = router;
