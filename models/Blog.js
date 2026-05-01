// models/Blog.js - Blog Model
const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    excerpt: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: ''
    },
    author: {
        type: String,
        default: 'Linknet Fiber'
    },
    category: {
        type: String,
        default: 'General'
    },
    tags: [{
        type: String
    }],
    published: {
        type: Boolean,
        default: false
    },
    publishedAt: {
        type: Date
    },
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster queries
blogSchema.index({ published: 1, order: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
