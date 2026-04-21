// seed-admin.js - Script to create default admin account
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

async function seedAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });

        if (existingAdmin) {
            console.log('Admin already exists:', existingAdmin.email);
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

        // Create admin
        const admin = await Admin.create({
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            name: 'System Administrator',
            role: 'super_admin',
            status: 'active'
        });

        console.log('✅ Admin account created successfully!');
        console.log(`Email: ${admin.email}`);
        console.log(`Password: ${process.env.ADMIN_PASSWORD}`);
        console.log(`Role: ${admin.role}`);

    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the seeding function
seedAdmin();