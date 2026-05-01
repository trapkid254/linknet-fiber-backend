// routes/products.js - Products Routes
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload').single('image');

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
router.post('/', protect, authorize('admin', 'super_admin', 'support', 'sales'), (req, res) => {
    console.log('POST /api/products - User:', req.admin ? req.admin.email : 'No admin', 'Role:', req.admin ? req.admin.role : 'N/A');
    upload(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ success: false, error: err.message });
        }
        
        try {
            const productData = req.body;
            console.log('Product data:', productData);
            
            // Add image path if file was uploaded
            if (req.file) {
                productData.image = `/uploads/${req.file.filename}`;
            }
            
            const product = await Product.create(productData);
            console.log('Product created successfully:', product._id);
            res.status(201).json({ success: true, product });
        } catch (error) {
            console.error('Error creating product:', error);
            res.status(500).json({ success: false, error: 'Error creating product' });
        }
    });
});

// ─── PUT /api/products/:id - Update product (admin only) ───────────────────────
router.put('/:id', protect, authorize('admin', 'super_admin', 'support', 'sales'), (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ success: false, error: err.message });
        }
        
        try {
            const productData = req.body;
            
            // Add image path if file was uploaded
            if (req.file) {
                productData.image = `/uploads/${req.file.filename}`;
            }
            
            const product = await Product.findByIdAndUpdate(
                req.params.id,
                productData,
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
});

// ─── DELETE /api/products/:id - Delete product (admin only) ────────────────────
router.delete('/:id', protect, authorize('admin', 'super_admin', 'support', 'sales'), async (req, res) => {
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
