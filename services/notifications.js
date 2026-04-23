// services/notifications.js - Email and SMS Services
const nodemailer = require('nodemailer');
const axios = require('axios');

// Email Service Configuration
const emailConfig = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER || 'linknetfiber@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
};

// SMS Service Configuration (Africa's Talking)
const smsConfig = {
    apiKey: process.env.SMS_API_KEY || 'your-africas-talking-key',
    username: process.env.SMS_USERNAME || 'sandbox',
    from: process.env.SMS_FROM || 'LinknetFiber',
    environment: process.env.SMS_ENV || 'sandbox' // sandbox or production
};

// Create email transporter
const createEmailTransporter = () => {
    return nodemailer.createTransporter(emailConfig);
};

// Email Service Class
class EmailService {
    constructor() {
        this.transporter = createEmailTransporter();
    }

    async sendEmail(options) {
        try {
            const mailOptions = {
                from: `"Linknet Fiber" <${emailConfig.auth.user}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text
            };

            const result = await this.transporter.sendMail(mailOptions);
            return {
                success: true,
                messageId: result.messageId,
                response: result.response
            };
        } catch (error) {
            console.error('Email sending error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Welcome email for new customers
    async sendWelcomeEmail(customer) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Welcome to Linknet Fiber</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #1E4D8C; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
                    .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Welcome to Linknet Fiber!</h1>
                    <p>Your journey to lightning-fast internet begins now</p>
                </div>
                <div class="content">
                    <p>Dear ${customer.fullname},</p>
                    <p>Thank you for choosing Linknet Fiber as your internet service provider. Your account has been successfully created.</p>
                    <h3>Your Account Details:</h3>
                    <ul>
                        <li><strong>Customer ID:</strong> ${customer.customerId}</li>
                        <li><strong>Email:</strong> ${customer.email}</li>
                        <li><strong>Phone:</strong> ${customer.phone}</li>
                        <li><strong>Package:</strong> ${customer.currentPackage || 'Basic Package'}</li>
                    </ul>
                    <p>To get started, please login to your customer portal to manage your account and services.</p>
                    <a href="https://linknet-fiber.netlify.app/client/login.html" class="btn">Login to Your Account</a>
                    <p>If you have any questions, please don't hesitate to contact our support team.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Linknet Fiber. All rights reserved.</p>
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: customer.email,
            subject: 'Welcome to Linknet Fiber - Your Account is Ready!',
            html: html,
            text: `Welcome to Linknet Fiber! Your account has been created. Customer ID: ${customer.customerId}`
        });
    }

    // Payment confirmation email
    async sendPaymentConfirmationEmail(customer, paymentDetails) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Payment Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #1E4D8C; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
                    .payment-details { background: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
                    .amount { font-size: 24px; font-weight: bold; color: #28a745; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Payment Confirmation</h1>
                    <p>Your payment has been received successfully</p>
                </div>
                <div class="content">
                    <p>Dear ${customer.fullname},</p>
                    <p>We're pleased to confirm that we've received your payment.</p>
                    <div class="payment-details">
                        <h3>Payment Details:</h3>
                        <p><strong>Amount:</strong> <span class="amount">KES ${paymentDetails.amount}</span></p>
                        <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId}</p>
                        <p><strong>Payment Method:</strong> ${paymentDetails.method}</p>
                        <p><strong>Date:</strong> ${new Date(paymentDetails.date).toLocaleDateString()}</p>
                    </div>
                    <p>Your outstanding balance has been updated. You can view your payment history in your customer portal.</p>
                    <a href="https://linknet-fiber.netlify.app/client/login.html" class="btn">View Your Account</a>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Linknet Fiber. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: customer.email,
            subject: 'Payment Confirmation - Linknet Fiber',
            html: html,
            text: `Payment confirmation: KES ${paymentDetails.amount} received. Transaction ID: ${paymentDetails.transactionId}`
        });
    }

    // Support ticket confirmation
    async sendSupportTicketEmail(customer, ticketDetails) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Support Ticket Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #1E4D8C; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
                    .ticket-details { background: #f8f9fa; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
                    .priority { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
                    .priority.high { background: #dc3545; color: white; }
                    .priority.medium { background: #ffc107; color: black; }
                    .priority.low { background: #28a745; color: white; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Support Ticket Created</h1>
                    <p>We've received your support request</p>
                </div>
                <div class="content">
                    <p>Dear ${customer.fullname},</p>
                    <p>Your support ticket has been successfully created and our team will respond within 24 hours.</p>
                    <div class="ticket-details">
                        <h3>Ticket Details:</h3>
                        <p><strong>Ticket ID:</strong> ${ticketDetails.ticketId}</p>
                        <p><strong>Category:</strong> ${ticketDetails.category}</p>
                        <p><strong>Subject:</strong> ${ticketDetails.subject}</p>
                        <p><strong>Priority:</strong> <span class="priority ${ticketDetails.priority}">${ticketDetails.priority.toUpperCase()}</span></p>
                        <p><strong>Created:</strong> ${new Date(ticketDetails.createdAt).toLocaleDateString()}</p>
                    </div>
                    <p>You can track the status of your ticket in your customer portal.</p>
                    <a href="https://linknet-fiber.netlify.app/client/login.html" class="btn">Track Your Ticket</a>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Linknet Fiber. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: customer.email,
            subject: `Support Ticket Created - #${ticketDetails.ticketId}`,
            html: html,
            text: `Support ticket #${ticketDetails.ticketId} created. We will respond within 24 hours.`
        });
    }

    // Package upgrade notification
    async sendPackageUpgradeEmail(customer, upgradeDetails) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Package Upgrade Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: #1E4D8C; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
                    .upgrade-details { background: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Package Upgrade</h1>
                    <p>Your package has been upgraded successfully</p>
                </div>
                <div class="content">
                    <p>Dear ${customer.fullname},</p>
                    <p>Your package upgrade request has been processed successfully.</p>
                    <div class="upgrade-details">
                        <h3>Upgrade Details:</h3>
                        <p><strong>New Package:</strong> ${upgradeDetails.newPackage}</p>
                        <p><strong>Previous Package:</strong> ${upgradeDetails.previousPackage}</p>
                        <p><strong>New Monthly Cost:</strong> KES ${upgradeDetails.newCost}</p>
                        <p><strong>Effective Date:</strong> ${new Date(upgradeDetails.effectiveDate).toLocaleDateString()}</p>
                    </div>
                    <p>Enjoy your enhanced internet speeds and features!</p>
                    <a href="https://linknet-fiber.netlify.app/client/login.html" class="btn">View Your Account</a>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Linknet Fiber. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: customer.email,
            subject: 'Package Upgrade Confirmation - Linknet Fiber',
            html: html,
            text: `Package upgraded to ${upgradeDetails.newPackage}. New monthly cost: KES ${upgradeDetails.newCost}`
        });
    }
}

// SMS Service Class
class SMSService {
    constructor() {
        this.config = smsConfig;
    }

    async sendSMS(phoneNumber, message) {
        try {
            // Format phone number (remove +254 if present, ensure starts with 254)
            let formattedPhone = phoneNumber.replace(/\+/g, '');
            if (!formattedPhone.startsWith('254')) {
                formattedPhone = `254${formattedPhone.replace(/^0/, '')}`;
            }

            // Africa's Talking API
            const url = `https://api.africastalking.com/version1/messaging`;
            
            const data = {
                username: this.config.username,
                to: formattedPhone,
                message: message,
                from: this.config.from
            };

            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'apiKey': this.config.apiKey
            };

            const response = await axios.post(url, data, { headers });

            return {
                success: true,
                messageId: response.data.SMSMessageData.Recipients[0].messageId,
                status: response.data.SMSMessageData.Recipients[0].status
            };

        } catch (error) {
            console.error('SMS sending error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Send welcome SMS
    async sendWelcomeSMS(customer) {
        const message = `Welcome to Linknet Fiber! Your account ${customer.customerId} is now active. Login to manage your services: https://linknet-fiber.netlify.app/client/login.html`;
        return await this.sendSMS(customer.phone, message);
    }

    // Send payment confirmation SMS
    async sendPaymentConfirmationSMS(customer, amount, transactionId) {
        const message = `Payment of KES ${amount} received successfully. Transaction ID: ${transactionId}. Thank you for choosing Linknet Fiber!`;
        return await this.sendSMS(customer.phone, message);
    }

    // Send service notification SMS
    async sendServiceNotificationSMS(customer, message) {
        const notification = `Linknet Fiber: ${message}. Account: ${customer.customerId}. Reply STOP to unsubscribe.`;
        return await this.sendSMS(customer.phone, notification);
    }
}

// Notification Service Manager
class NotificationService {
    constructor() {
        this.emailService = new EmailService();
        this.smsService = new SMSService();
    }

    async sendWelcomeNotification(customer, channels = ['email', 'sms']) {
        const results = {};
        
        if (channels.includes('email')) {
            results.email = await this.emailService.sendWelcomeEmail(customer);
        }
        
        if (channels.includes('sms')) {
            results.sms = await this.smsService.sendWelcomeSMS(customer);
        }
        
        return results;
    }

    async sendPaymentNotification(customer, paymentDetails, channels = ['email', 'sms']) {
        const results = {};
        
        if (channels.includes('email')) {
            results.email = await this.emailService.sendPaymentConfirmationEmail(customer, paymentDetails);
        }
        
        if (channels.includes('sms')) {
            results.sms = await this.smsService.sendPaymentConfirmationSMS(customer, paymentDetails.amount, paymentDetails.transactionId);
        }
        
        return results;
    }

    async sendSupportTicketNotification(customer, ticketDetails, channels = ['email']) {
        const results = {};
        
        if (channels.includes('email')) {
            results.email = await this.emailService.sendSupportTicketEmail(customer, ticketDetails);
        }
        
        if (channels.includes('sms')) {
            const message = `Support ticket #${ticketDetails.ticketId} created. We'll respond within 24 hours.`;
            results.sms = await this.smsService.sendSMS(customer.phone, message);
        }
        
        return results;
    }

    async sendPackageUpgradeNotification(customer, upgradeDetails, channels = ['email', 'sms']) {
        const results = {};
        
        if (channels.includes('email')) {
            results.email = await this.emailService.sendPackageUpgradeEmail(customer, upgradeDetails);
        }
        
        if (channels.includes('sms')) {
            const message = `Package upgraded to ${upgradeDetails.newPackage}. Enjoy enhanced speeds!`;
            results.sms = await this.smsService.sendSMS(customer.phone, message);
        }
        
        return results;
    }

    async sendCustomNotification(customer, options) {
        const results = {};
        
        if (options.email) {
            results.email = await this.emailService.sendEmail({
                to: customer.email,
                subject: options.subject,
                html: options.html,
                text: options.text
            });
        }
        
        if (options.sms) {
            results.sms = await this.smsService.sendSMS(customer.phone, options.message);
        }
        
        return results;
    }
}

// Export services
module.exports = {
    EmailService,
    SMSService,
    NotificationService
};
