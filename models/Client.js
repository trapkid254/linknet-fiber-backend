// models/Client.js - Client Model
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clientSchema = new mongoose.Schema({
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
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [
            /^\+?[\d\s\-\(\)]+$/,
            'Please provide a valid phone number'
        ]
    },
    mpesaNumber: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    package: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package'
    },
    installationStatus: {
        type: String,
        enum: ['pending', 'approved', 'survey_scheduled', 'installation_scheduled', 'installed', 'completed'],
        default: 'pending'
    },
    installationAddress: {
        type: String
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
clientSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Hash password before saving
clientSchema.pre('save', async function(next) {
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
clientSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
clientSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
clientSchema.methods.incrementLoginAttempts = async function() {
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
    
    await this.save();
};

// Reset login attempts
clientSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.lastLogin = Date.now();
    await this.save();
};

// Don't return password in JSON
clientSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.__v;
        return ret;
    }
});

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
