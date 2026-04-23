// models/Admin.js - Admin Model
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
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
        minlength: [6, 'Password must be at least 6 characters']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'super_admin', 'support', 'sales'],
        default: 'admin'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: {
        type: Date
    },
    phone: {
        type: String,
        trim: true,
        match: [
            /^\+?[\d\s\-\(\)]+$/,
            'Please provide a valid phone number'
        ]
    },
    profileImage: {
        type: String,
        default: null
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    permissions: [{
        type: String,
        enum: [
            'manage_packages',
            'manage_requests',
            'manage_admins',
            'view_analytics',
            'manage_coverage',
            'manage_settings'
        ]
    }],
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
adminSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
adminSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
adminSchema.methods.incrementLoginAttempts = async function() {
    // Reset attempts if lock has expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = null;
    } else {
        this.loginAttempts += 1;
        
        // Lock account after 5 failed attempts
        if (this.loginAttempts >= 5) {
            this.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
        }
    }
    
    // Ensure name field exists for validation
    if (!this.name) {
        this.name = 'Administrator';
    }
    
    await this.save();
};

// Reset login attempts
adminSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.lastLogin = Date.now();
    
    // Ensure name field exists for validation
    if (!this.name) {
        this.name = 'Administrator';
    }
    
    await this.save();
};

// Virtual for full permissions list
adminSchema.virtual('allPermissions').get(function() {
    const rolePermissions = {
        'super_admin': [
            'manage_packages',
            'manage_requests',
            'manage_admins',
            'view_analytics',
            'manage_coverage',
            'manage_settings'
        ],
        'admin': [
            'manage_packages',
            'manage_requests',
            'view_analytics',
            'manage_coverage'
        ],
        'support': [
            'manage_requests',
            'view_analytics'
        ],
        'sales': [
            'manage_requests',
            'view_analytics'
        ]
    };
    
    return [...new Set([...rolePermissions[this.role], ...(this.permissions || [])])];
});

// Don't return password in JSON
adminSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.__v;
        return ret;
    }
});

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;