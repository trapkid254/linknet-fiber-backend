// models/Coverage.js - Coverage Area Model
const mongoose = require('mongoose');

const coverageSchema = new mongoose.Schema({
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    estate: {
        type: String,
        trim: true
    },
    county: {
        type: String,
        required: [true, 'County is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['available', 'unavailable', 'coming_soon'],
        default: 'available'
    },
    description: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field on save
coverageSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Coverage = mongoose.model('Coverage', coverageSchema);

module.exports = Coverage;
