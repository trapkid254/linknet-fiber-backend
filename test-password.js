require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

async function testPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Delete existing admin
        await Admin.deleteMany({});
        console.log('Deleted existing admin accounts');

        // Create new admin with fresh password
        const plainPassword = process.env.ADMIN_PASSWORD;
        console.log('Plain password:', plainPassword);

        // Hash password manually
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        console.log('Hashed password:', hashedPassword);

        // Test the hash immediately
        const testResult = await bcrypt.compare(plainPassword, hashedPassword);
        console.log('Hash test result:', testResult);

        // Create admin
        const admin = await Admin.create({
            email: process.env.ADMIN_EMAIL,
            password: plainPassword, // Let the model hash it
            name: 'System Administrator',
            role: 'super_admin',
            status: 'active'
        });

        console.log('Admin created:', admin.email);

        // Test password comparison using the model method
        const adminWithPassword = await Admin.findOne({ email: admin.email }).select('+password');
        const compareResult = await adminWithPassword.comparePassword(plainPassword);
        console.log('Model comparison result:', compareResult);

        // Test with wrong password
        const wrongResult = await adminWithPassword.comparePassword('wrongpassword');
        console.log('Wrong password result:', wrongResult);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testPassword();
