// models/Order.js - Order Model
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    items: [{
        name: String,
        price: Number,
        quantity: Number,
        icon: String
    }],
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    deliveryFee: {
        type: Number,
        default: 500
    },
    paymentMethod: {
        type: String,
        default: 'mpesa'
    },
    paymentPhone: String,
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
