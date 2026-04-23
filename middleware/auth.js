// middleware/auth.js - Authentication Middleware
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Customer = require('../models/Customer');

/**
 * Protect routes - Verify JWT token
 */
const protect = async (req, res, next) => {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'linknet-admin-secret-2024');
            
            // Get admin from token
            req.admin = await Admin.findById(decoded.id).select('-password');
            
            if (!req.admin) {
                return res.status(401).json({
                    success: false,
                    error: 'Not authorized, admin not found'
                });
            }
            
            // Check if admin is active
            if (req.admin.status !== 'active') {
                return res.status(401).json({
                    success: false,
                    error: 'Account is inactive or suspended'
                });
            }
            
            next();
        } catch (error) {
            console.error('Auth error:', error);
            
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    error: 'Not authorized, invalid token'
                });
            }
            
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Not authorized, token expired'
                });
            }
            
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Not authorized, no token provided'
        });
    }
};

/**
 * Role-based authorization
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized'
            });
        }
        
        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                error: `Role ${req.admin.role} is not authorized to access this route`
            });
        }
        
        next();
    };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'linknet-admin-secret-2024');
            req.admin = await Admin.findById(decoded.id).select('-password');
        } catch (error) {
            // Token is invalid but we don't fail the request
            req.admin = null;
        }
    } else {
        req.admin = null;
    }
    
    next();
};

/**
 * Generate JWT Token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'linknet-admin-secret-2024', {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

/**
 * Verify token and return decoded data (utility function)
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'linknet-admin-secret-2024');
    } catch (error) {
        return null;
    }
};

/**
 * Rate limit by API key (for future use)
 */
const apiKeyAuth = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key required'
        });
    }
    
    // Validate API key (implement as needed)
    const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
    
    if (!validApiKeys.includes(apiKey)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid API key'
        });
    }
    
    next();
};

module.exports = {
    protect,
    authorize,
    optionalAuth,
    protectCustomer,
    generateToken,
    verifyToken,
    apiKeyAuth
};