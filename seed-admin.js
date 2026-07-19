// seed-admin.js - Script to create default admin account
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

async function seedAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB');

        const adminEmail = (process.env.ADMIN_EMAIL || 'administrator@linknetfiber.com').trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || 'Linknet@2024';

        const existingAdmin = await Admin.findOne({ email: adminEmail });

        if (existingAdmin) {
            existingAdmin.password = adminPassword;
            existingAdmin.status = 'active';
            existingAdmin.loginAttempts = 0;
            existingAdmin.lockUntil = null;
            await existingAdmin.save();
            console.log('Admin password reset for:', existingAdmin.email);
            return;
        }

        const admin = await Admin.create({
            email: adminEmail,
            password: adminPassword,
            name: 'System Administrator',
            role: 'super_admin',
            status: 'active'
        });

        console.log('Admin account created successfully!');
        console.log(`Email: ${admin.email}`);
        console.log(`Password: ${adminPassword}`);
        console.log(`Role: ${admin.role}`);

    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

seedAdmin();
