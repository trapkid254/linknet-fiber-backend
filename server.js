// server.js - Main Express Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import routes
const packageRoutes = require('./routes/packages');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/clients');
const paymentRoutes = require('./routes/payments');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

// Initialize Express app
const app = express();

// Trust proxy (important for Render/Railway deployment)
app.set('trust proxy', 1);

// ====== Security Middleware ======
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://picsum.photos"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        },
    },
}));

// ====== CORS Configuration ======
const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.CLIENT_URL_ALT,
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5500',
    'https://linknet-fiber.netlify.app',
    'https://trapkid254.github.io',
    'https://trapkid254.github.io/linknet-fiber-frontend',
    'https://linknetkenya.co.ke'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, mobile apps)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// ====== Standard Middleware ======
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// ─── Static Files ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====== Routes ======
app.get('/', (req, res) => {
    res.json({
        message: 'Linknet Fiber API Server',
        version: '1.0.1',
        status: 'running',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            packages: '/api/packages',
            requests: '/api/requests',
            admin: '/api/admin',
            clients: '/api/clients',
            payments: '/api/payments'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/packages', packageRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// ====== Error Handling ======

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);

    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, error: 'Validation Error', details: errors });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({ success: false, error: `${field} already exists` });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token expired' });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ====== MongoDB Connection + Start Server ======
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/linknet_fiber';

async function startServer() {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log(`✅ MongoDB connected: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

        const server = app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════╗
║   🚀 Linknet Fiber API Server                           ║
║   Environment : ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║   Port        : ${String(PORT).padEnd(38)}║
║   DB          : connected                               ║
╚══════════════════════════════════════════════════════════╝
            `);
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            console.log(`\n🛑 ${signal} received. Shutting down...`);
            server.close(async () => {
                await mongoose.connection.close();
                console.log('✅ MongoDB connection closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        process.on('unhandledRejection', (err) => {
            console.error('❌ Unhandled Rejection:', err);
            server.close(() => process.exit(1));
        });

        process.on('uncaughtException', (err) => {
            console.error('❌ Uncaught Exception:', err);
            server.close(() => process.exit(1));
        });

        return server;

    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        console.error('   Check your MONGODB_URI in .env');
        process.exit(1);
    }
}

startServer();

module.exports = app;
