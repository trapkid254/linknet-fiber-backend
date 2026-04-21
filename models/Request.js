// models/Request.js - Installation Request Model
const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        unique: true,
        default: () => 'LN-' + Date.now().toString(36).toUpperCase()
    },
    fullname: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email address'
        ]
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [
            /^(?:\+254|0)[17]\d{8}$/,
            'Please provide a valid Kenyan phone number'
        ]
    },
    idNumber: {
        type: String,
        trim: true
    },
    // Address Information
    county: {
        type: String,
        required: [true, 'County is required'],
        enum: ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'kiambu', 'other']
    },
    estate: {
        type: String,
        required: [true, 'Estate/Area is required'],
        trim: true
    },
    street: {
        type: String,
        required: [true, 'Street/Road is required'],
        trim: true
    },
    building: {
        type: String,
        trim: true
    },
    houseNumber: {
        type: String,
        trim: true
    },
    landmark: {
        type: String,
        trim: true
    },
    // Package Information
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: [true, 'Package selection is required']
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },
    // Installation Preferences
    preferredDate: {
        type: Date,
        required: [true, 'Preferred installation date is required']
    },
    preferredTime: {
        type: String,
        enum: ['morning', 'afternoon', 'evening'],
        required: [true, 'Preferred time slot is required']
    },
    // Status Information
    status: {
        type: String,
        enum: ['pending', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rejected'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    // Installation Details
    scheduledDate: {
        type: Date
    },
    assignedTechnician: {
        type: String,
        trim: true
    },
    installationNotes: {
        type: String
    },
    completionDate: {
        type: Date
    },
    // Payment Information
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'partially_paid', 'refunded'],
        default: 'pending'
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'mpesa', 'bank_transfer', 'card'],
    },
    // Communication
    terms: {
        type: Boolean,
        required: [true, 'Terms acceptance is required'],
        validate: {
            validator: function(v) {
                return v === true;
            },
            message: 'You must accept the terms and conditions'
        }
    },
    marketing: {
        type: Boolean,
        default: false
    },
    // Tracking
    statusHistory: [{
        status: String,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        notes: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    notes: [{
        content: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    source: {
        type: String,
        enum: ['website', 'phone', 'walk_in', 'partner'],
        default: 'website'
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
});

// Update the updatedAt field on save
requestSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Add to status history if status changed
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            timestamp: Date.now()
        });
        
        // Set completion date if status becomes completed
        if (this.status === 'completed' && !this.completionDate) {
            this.completionDate = Date.now();
        }
    }
    
    next();
});

// Populate package details on find
requestSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'packageId',
        select: 'name speed price features'
    });
    next();
});

// Virtual for full address
requestSchema.virtual('fullAddress').get(function() {
    const parts = [
        this.houseNumber,
        this.building,
        this.street,
        this.estate,
        this.county
    ].filter(Boolean);
    return parts.join(', ');
});

// Virtual for status display
requestSchema.virtual('statusDisplay').get(function() {
    const statusMap = {
        'pending': 'Pending Review',
        'approved': 'Approved',
        'scheduled': 'Installation Scheduled',
        'in_progress': 'Installation in Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'rejected': 'Rejected'
    };
    return statusMap[this.status] || this.status;
});

// Ensure virtuals are included
requestSchema.set('toJSON', { virtuals: true });
requestSchema.set('toObject', { virtuals: true });

// Indexes for faster queries
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ email: 1 });
requestSchema.index({ phone: 1 });
requestSchema.index({ requestId: 1 });
requestSchema.index({ preferredDate: 1 });

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;