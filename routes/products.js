// routes/products.js - Products Routes
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

// ─── GET /api/products - Get all products (public) ─────────────────────────
router.get('/', async (req, res) => {
    try {
        const { category, status } = req.query;
        const filter = {};
        
        if (category) filter.category = category;
        if (status) filter.status = status;
        
        const products = await Product.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, error: 'Error fetching products' });
    }
});

// ─── GET /api/products/:id - Get single product (public) ─────────────────────
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, product });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ success: false, error: 'Error fetching product' });
    }
});

// ─── POST /api/products - Create product (admin only) ───────────────────────────
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json({ success: true, product });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ success: false, error: 'Error creating product' });
    }
});

// ─── PUT /api/products/:id - Update product (admin only) ───────────────────────
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, product });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, error: 'Error updating product' });
    }
});

// ─── DELETE /api/products/:id - Delete product (admin only) ────────────────────
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, error: 'Error deleting product' });
    }
});

module.exports = router;
