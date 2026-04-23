// models/Customer.js - Customer Model
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
    customerId: {
        type: String,
        unique: true,
        default: () => 'CUST-' + Date.now().toString(36).toUpperCase()
    },
    // Account Information
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email address'
        ]
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    // Personal Information
    fullname: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
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
        required: [true, 'ID number is required'],
        trim: true,
        unique: true
    },
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        default: 'other'
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
    postalCode: {
        type: String,
        trim: true
    },
    // Service Information
    currentPackage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package'
    },
    services: [{
        package: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Package',
            required: true
        },
        status: {
            type: String,
            enum: ['active', 'suspended', 'terminated', 'pending'],
            default: 'pending'
        },
        installationDate: Date,
        activationDate: Date,
        deactivationDate: Date,
        monthlyFee: Number,
        billingCycle: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
            default: 'monthly'
        },
        autoRenew: {
            type: Boolean,
            default: true
        }
    }],
    // Account Status
    accountStatus: {
        type: String,
        enum: ['active', 'suspended', 'terminated', 'pending'],
        default: 'pending'
    },
    registrationDate: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    // Billing Information
    billingAddress: {
        type: String,
        trim: true
    },
    paymentMethod: {
        type: String,
        enum: ['mpesa', 'bank_transfer', 'card', 'cash'],
        default: 'mpesa'
    },
    mpesaNumber: {
        type: String,
        match: [
            /^(?:\+254|0)[17]\d{8}$/,
            'Please provide a valid Kenyan phone number'
        ]
    },
    outstandingBalance: {
        type: Number,
        default: 0
    },
    creditLimit: {
        type: Number,
        default: 0
    },
    // Communication Preferences
    communicationPreferences: {
        email: {
            type: Boolean,
            default: true
        },
        sms: {
            type: Boolean,
            default: true
        },
        phone: {
            type: Boolean,
            default: false
        },
        marketing: {
            type: Boolean,
            default: false
        }
    },
    // Technical Information
    equipment: [{
        type: {
            type: String,
            enum: ['modem', 'router', 'cable', 'other'],
            required: true
        },
        brand: String,
        model: String,
        serialNumber: String,
        installationDate: Date,
        status: {
            type: String,
            enum: ['installed', 'maintenance', 'replaced', 'returned'],
            default: 'installed'
        },
        notes: String
    }],
    // Support History
    supportTickets: [{
        ticketId: {
            type: String,
            unique: true,
            default: () => 'TKT-' + Date.now().toString(36).toUpperCase()
        },
        subject: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        category: {
            type: String,
            enum: ['technical', 'billing', 'account', 'other'],
            default: 'technical'
        },
        priority: {
            type: String,
            enum: ['low', 'normal', 'high', 'urgent'],
            default: 'normal'
        },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'resolved', 'closed'],
            default: 'open'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        resolvedAt: Date,
        resolution: String,
        assignedTo: String
    }],
    // Metadata
    source: {
        type: String,
        enum: ['website', 'phone', 'walk_in', 'partner', 'admin_created'],
        default: 'website'
    },
    ipAddress: String,
    userAgent: String,
    referralCode: String,
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
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

// Indexes for faster queries
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ customerId: 1 });
customerSchema.index({ accountStatus: 1 });
customerSchema.index({ county: 1, estate: 1 });
customerSchema.index({ 'services.status': 1 });

// Virtual for full address
customerSchema.virtual('fullAddress').get(function() {
    const parts = [
        this.houseNumber,
        this.building,
        this.street,
        this.estate,
        this.county
    ].filter(Boolean);
    return parts.join(', ');
});

// Virtual for active services
customerSchema.virtual('activeServices').get(function() {
    return this.services.filter(service => service.status === 'active');
});

// Virtual for total monthly cost
customerSchema.virtual('totalMonthlyCost').get(function() {
    return this.activeServices.reduce((total, service) => total + (service.monthlyFee || 0), 0);
});

// Virtual for account age
customerSchema.virtual('accountAge').get(function() {
    const now = new Date();
    const registrationDate = this.registrationDate || now;
    const diffTime = Math.abs(now - registrationDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// Pre-save middleware
customerSchema.pre('save', async function(next) {
    this.updatedAt = Date.now();
    
    // Hash password if modified
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    
    next();
});

// Pre-remove middleware
customerSchema.pre('remove', async function(next) {
    // Handle any cleanup before removing customer
    next();
});

// Instance methods
customerSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

customerSchema.methods.getSupportStats = function() {
    const stats = {
        total: this.supportTickets.length,
        open: this.supportTickets.filter(ticket => ticket.status === 'open').length,
        inProgress: this.supportTickets.filter(ticket => ticket.status === 'in_progress').length,
        resolved: this.supportTickets.filter(ticket => ticket.status === 'resolved').length
    };
    return stats;
};

customerSchema.methods.getServiceHistory = function() {
    return this.services.map(service => ({
        package: service.package,
        status: service.status,
        installationDate: service.installationDate,
        activationDate: service.activationDate,
        deactivationDate: service.deactivationDate,
        monthlyFee: service.monthlyFee,
        billingCycle: service.billingCycle
    }));
};

// Static methods
customerSchema.statics.findByEmailOrPhone = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { phone: identifier }
        ]
    });
};

customerSchema.statics.getActiveCustomers = function() {
    return this.find({ accountStatus: 'active' });
};

customerSchema.statics.getCustomersByCounty = function(county) {
    return this.find({ county: county.toLowerCase() });
};

customerSchema.statics.getCustomersWithOverdueBalance = function() {
    return this.find({ outstandingBalance: { $gt: 0 } });
};

// Ensure virtuals are included
customerSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        return ret;
    }
});
customerSchema.set('toObject', { virtuals: true });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
