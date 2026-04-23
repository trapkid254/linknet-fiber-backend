// middleware/security.js - Security Middleware
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { success: false, error: message },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// Different rate limits for different endpoints
const authLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many authentication attempts, please try again later.'
);

const generalLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests
    'Too many requests, please try again later.'
);

const strictLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    10, // 10 requests
    'Too many requests, please slow down.'
);

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body) {
        // Remove any potential MongoDB injection
        mongoSanitize()(req, res, () => {});
        
        // Sanitize string fields
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = validator.escape(req.body[key]);
                req.body[key] = xss(req.body[key]);
            }
        });
    }

    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = validator.escape(req.query[key]);
            }
        });
    }

    next();
};

// Password strength validation
const validatePasswordStrength = (req, res, next) => {
    const password = req.body.password;
    
    if (!password) {
        return res.status(400).json({
            success: false,
            error: 'Password is required'
        });
    }

    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters long'
        });
    }

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return res.status(400).json({
            success: false,
            error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        });
    }

    next();
};

// Email validation
const validateEmail = (req, res, next) => {
    const email = req.body.email;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            error: 'Email is required'
        });
    }

    if (!validator.isEmail(email)) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a valid email address'
        });
    }

    next();
};

// Phone validation (Kenyan format)
const validatePhone = (req, res, next) => {
    const phone = req.body.phone;
    
    if (!phone) {
        return res.status(400).json({
            success: false,
            error: 'Phone number is required'
        });
    }

    // Remove spaces and dashes
    const cleanPhone = phone.replace(/[\s-]/g, '');
    
    // Validate Kenyan phone format
    const phoneRegex = /^(\+254|0)?[7]\d{8}$/;
    
    if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a valid Kenyan phone number'
        });
    }

    next();
};

// ID number validation
const validateIdNumber = (req, res, next) => {
    const idNumber = req.body.idNumber;
    
    if (!idNumber) {
        return res.status(400).json({
            success: false,
            error: 'ID number is required'
        });
    }

    // Validate ID number format (6-8 digits)
    const idRegex = /^\d{6,8}$/;
    
    if (!idRegex.test(idNumber)) {
        return res.status(400).json({
            success: false,
            error: 'ID number must be 6-8 digits'
        });
    }

    next();
};

// CORS security
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.CLIENT_URL,
            process.env.CLIENT_URL_ALT,
            'http://localhost:3000',
            'http://127.0.0.1:5500',
            'http://127.0.0.1:5501',
            'http://localhost:5500',
            'https://linknet-fiber.netlify.app',
            'https://trapkid254.github.io',
            'https://trapkid254.github.io/linknet-fiber-frontend'
        ].filter(Boolean);

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

// Security headers configuration
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://picsum.photos"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"]
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
};

// Request logging for security
const securityLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${ip} - User-Agent: ${userAgent}`);
    
    next();
};

// Block suspicious IPs (basic implementation)
const suspiciousIPs = new Set();
const blockSuspiciousIP = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (suspiciousIPs.has(ip)) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    next();
};

// Add IP to suspicious list (call this after detecting suspicious activity)
const addSuspiciousIP = (ip) => {
    suspiciousIPs.add(ip);
    console.log(`Added suspicious IP: ${ip}`);
};

// Session security
const sessionSecurity = {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
};

module.exports = {
    authLimiter,
    generalLimiter,
    strictLimiter,
    sanitizeInput,
    validatePasswordStrength,
    validateEmail,
    validatePhone,
    validateIdNumber,
    corsOptions,
    helmetConfig,
    securityLogger,
    blockSuspiciousIP,
    addSuspiciousIP,
    sessionSecurity
};
