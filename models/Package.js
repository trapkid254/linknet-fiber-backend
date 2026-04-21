// models/Package.js - Internet Package Model
const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Package name is required'],
        unique: true,
        trim: true,
        maxlength: [50, 'Package name cannot exceed 50 characters']
    },
    speed: {
        type: Number,
        required: [true, 'Internet speed is required'],
        min: [1, 'Speed must be at least 1 Mbps'],
        max: [10000, 'Speed cannot exceed 10000 Mbps']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    features: [{
        type: String,
        trim: true
    }],
    featured: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        enum: ['home', 'business', 'enterprise'],
        default: 'home'
    },
    discount: {
        percentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        validUntil: {
            type: Date
        }
    },
    installationFee: {
        type: Number,
        default: 0
    },
    contractPeriod: {
        type: Number, // in months, 0 for no contract
        default: 0
    },
    dataCap: {
        type: Number, // in GB, 0 for unlimited
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
});

// Update the updatedAt field on save
packageSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual for display price (with discount)
packageSchema.virtual('displayPrice').get(function() {
    if (this.discount && this.discount.percentage > 0 && 
        (!this.discount.validUntil || this.discount.validUntil > new Date())) {
        return this.price * (1 - this.discount.percentage / 100);
    }
    return this.price;
});

// Virtual for formatted speed
packageSchema.virtual('formattedSpeed').get(function() {
    if (this.speed >= 1000) {
        return `${(this.speed / 1000).toFixed(1)} Gbps`;
    }
    return `${this.speed} Mbps`;
});

// Virtual for data cap display
packageSchema.virtual('dataCapDisplay').get(function() {
    if (this.dataCap === 0) {
        return 'Unlimited';
    }
    if (this.dataCap >= 1000) {
        return `${(this.dataCap / 1000).toFixed(1)} TB`;
    }
    return `${this.dataCap} GB`;
});

// Ensure virtuals are included in JSON
packageSchema.set('toJSON', { virtuals: true });
packageSchema.set('toObject', { virtuals: true });

// Index for faster queries
packageSchema.index({ isActive: 1, category: 1 });
packageSchema.index({ featured: 1 });
packageSchema.index({ price: 1 });

const Package = mongoose.model('Package', packageSchema);

module.exports = Package;