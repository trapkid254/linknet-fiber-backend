// routes/blogs.js - Blog Routes
const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { protect, authorize } = require('../middleware/auth');

// ─── GET /api/blogs - Get all published blogs (public) ───────────────────────
router.get('/', async (req, res) => {
    try {
        const blogs = await Blog.find({ published: true })
            .sort({ order: 1, publishedAt: -1 })
            .select('title slug excerpt image author category tags publishedAt');
        
        res.json({ success: true, data: blogs });
    } catch (error) {
        console.error('Get blogs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch blogs' });
    }
});

// ─── GET /api/blogs/:slug - Get single blog by slug (public) ───────────────────
router.get('/:slug', async (req, res) => {
    try {
        const blog = await Blog.findOne({ slug: req.params.slug, published: true });
        
        if (!blog) {
            return res.status(404).json({ success: false, error: 'Blog not found' });
        }
        
        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Get blog error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch blog' });
    }
});

// ─── POST /api/blogs - Create blog (admin only) ────────────────────────────────
router.post('/', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const { title, slug, excerpt, content, image, author, category, tags, order } = req.body;
        
        const blog = await Blog.create({
            title,
            slug,
            excerpt,
            content,
            image,
            author,
            category,
            tags,
            order,
            published: false
        });
        
        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(500).json({ success: false, error: 'Failed to create blog' });
    }
});

// ─── PUT /api/blogs/:id - Update blog (admin only) ────────────────────────────
router.put('/:id', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!blog) {
            return res.status(404).json({ success: false, error: 'Blog not found' });
        }
        
        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ success: false, error: 'Failed to update blog' });
    }
});

// ─── DELETE /api/blogs/:id - Delete blog (admin only) ─────────────────────────
router.delete('/:id', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ success: false, error: 'Blog not found' });
        }
        
        res.json({ success: true, message: 'Blog deleted successfully' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete blog' });
    }
});

// ─── PUT /api/blogs/:id/publish - Publish/unpublish blog (admin only) ───────────
router.put('/:id/publish', protect, authorize('admin', 'super_admin'), async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        
        if (!blog) {
            return res.status(404).json({ success: false, error: 'Blog not found' });
        }
        
        blog.published = req.body.published !== undefined ? req.body.published : !blog.published;
        
        if (blog.published && !blog.publishedAt) {
            blog.publishedAt = new Date();
        }
        
        await blog.save();
        
        res.json({ success: true, data: blog });
    } catch (error) {
        console.error('Publish blog error:', error);
        res.status(500).json({ success: false, error: 'Failed to publish blog' });
    }
});

module.exports = router;
