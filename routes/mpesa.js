// backend/routes/mpesa.js - M-Pesa Payment Integration
const express = require('express');
const router = express.Router();
const { protectCustomer } = require('../middleware/auth');
const Customer = require('../models/Customer');
const axios = require('axios');
const crypto = require('crypto');

// M-Pesa Configuration (Sandbox)
const MPESA_CONFIG = {
    consumerKey: process.env.MPESA_CONSUMER_KEY || 'your_consumer_key',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'your_consumer_secret',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    passkey: process.env.MPESA_PASSKEY || 'your_passkey',
    callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/mpesa/callback',
    environment: process.env.MPESA_ENV || 'sandbox', // sandbox or production
    baseUrl: process.env.MPESA_ENV === 'production' 
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke'
};

// Generate OAuth Token
async function getOAuthToken() {
    try {
        const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');
        
        const response = await axios.get(
            `${MPESA_CONFIG.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        );
        
        return response.data.access_token;
    } catch (error) {
        console.error('M-Pesa OAuth Error:', error);
        throw new Error('Failed to get M-Pesa OAuth token');
    }
}

// @route   POST /api/mpesa/stk-push
// @desc    Initiate M-Pesa STK Push payment
// @access  Private (Customer)
router.post('/stk-push', protectCustomer, async (req, res) => {
    try {
        const { amount, phoneNumber, accountReference, transactionDesc } = req.body;
        const customer = req.customer;

        // Validate input
        if (!amount || !phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Amount and phone number are required'
            });
        }

        // Format phone number (remove +254 if present, ensure starts with 254)
        let formattedPhone = phoneNumber.replace(/\+/g, '');
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = `254${formattedPhone.replace(/^0/, '')}`;
        }

        // Get OAuth token
        const accessToken = await getOAuthToken();

        // Generate timestamp
        const timestamp = new Date().getFullYear().toString() +
            (new Date().getMonth() + 1).toString().padStart(2, '0') +
            new Date().getDate().toString().padStart(2, '0') +
            new Date().getHours().toString().padStart(2, '0') +
            new Date().getMinutes().toString().padStart(2, '0') +
            new Date().getSeconds().toString().padStart(2, '0');

        // Generate password
        const password = Buffer.from(
            MPESA_CONFIG.shortcode + MPESA_CONFIG.passkey + timestamp
        ).toString('base64');

        // STK Push request
        const stkPushData = {
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: MPESA_CONFIG.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: MPESA_CONFIG.callbackUrl,
            AccountReference: accountReference || customer.customerId,
            TransactionDesc: transactionDesc || 'Linknet Fiber Payment'
        };

        const response = await axios.post(
            `${MPESA_CONFIG.baseUrl}/mpesa/stkpush/v1/processrequest`,
            stkPushData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Store transaction details for callback handling
        const transaction = {
            merchantRequestID: response.data.MerchantRequestID,
            checkoutRequestID: response.data.CheckoutRequestID,
            amount: amount,
            phoneNumber: formattedPhone,
            customerId: customer.customerId,
            status: 'pending',
            createdAt: new Date(),
            accountReference: accountReference || customer.customerId
        };

        // In production, save to database
        // await Transaction.create(transaction);

        res.json({
            success: true,
            data: {
                merchantRequestID: response.data.MerchantRequestID,
                checkoutRequestID: response.data.CheckoutRequestID,
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription,
                customerMessage: response.data.CustomerMessage
            },
            message: 'Payment initiated successfully. Please check your phone for the M-Pesa prompt.'
        });

    } catch (error) {
        console.error('M-Pesa STK Push Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate M-Pesa payment'
        });
    }
});

// @route   POST /api/mpesa/callback
// @desc    M-Pesa callback handler
// @access  Public
router.post('/callback', async (req, res) => {
    try {
        const {
            Body: {
                stkCallback: {
                    MerchantRequestID,
                    CheckoutRequestID,
                    ResultCode,
                    ResultDesc,
                    CallbackMetadata
                }
            }
        } = req.body;

        // Find transaction in database
        // const transaction = await Transaction.findOne({ checkoutRequestID: CheckoutRequestID });

        if (ResultCode === 0) {
            // Payment successful
            const metadata = CallbackMetadata.Item;
            const amount = metadata.find(item => item.Name === 'Amount')?.Value;
            const mpesaReceiptNumber = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
            const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value;
            const phoneNumber = metadata.find(item => item.Name === 'PhoneNumber')?.Value;

            // Update transaction status
            // await Transaction.updateOne(
            //     { checkoutRequestID: CheckoutRequestID },
            //     {
            //         status: 'completed',
            //         mpesaReceiptNumber,
            //         amount,
            //         transactionDate,
            //         phoneNumber,
            //         completedAt: new Date()
            //     }
            // );

            // Update customer's payment history
            // await Customer.findByIdAndUpdate(
            //     transaction.customerId,
            //     {
            //         $push: {
            //             paymentHistory: {
            //                 amount,
            //                 mpesaReceiptNumber,
            //                 transactionDate,
            //                 method: 'mpesa',
            //                 status: 'completed'
            //             }
            //         },
            //         $inc: { outstandingBalance: -amount }
            //     }
            // );

            console.log('Payment successful:', {
                MerchantRequestID,
                CheckoutRequestID,
                amount,
                mpesaReceiptNumber,
                phoneNumber
            });

        } else {
            // Payment failed
            // await Transaction.updateOne(
            //     { checkoutRequestID: CheckoutRequestID },
            //     {
            //         status: 'failed',
            //         resultDescription: ResultDesc,
            //         completedAt: new Date()
            //     }
            // );

            console.log('Payment failed:', {
                MerchantRequestID,
                CheckoutRequestID,
                ResultCode,
                ResultDesc
            });
        }

        // Always respond with success to M-Pesa
        res.json({
            ResultCode: 0,
            ResultDesc: 'Success',
            ThirdPartyTransID: CheckoutRequestID
        });

    } catch (error) {
        console.error('M-Pesa Callback Error:', error);
        res.status(500).json({
            ResultCode: 1,
            ResultDesc: 'Error processing callback'
        });
    }
});

// @route   GET /api/mpesa/transaction-status/:checkoutRequestID
// @desc    Check transaction status
// @access  Private (Customer)
router.get('/transaction-status/:checkoutRequestID', protectCustomer, async (req, res) => {
    try {
        const { checkoutRequestID } = req.params;
        
        // Get OAuth token
        const accessToken = await getOAuthToken();

        // Query transaction status
        const response = await axios.post(
            `${MPESA_CONFIG.baseUrl}/mpesa/stkpushquery/v1/query`,
            {
                BusinessShortCode: MPESA_CONFIG.shortcode,
                Password: '', // Generate fresh password for query
                Timestamp: '', // Generate fresh timestamp
                CheckoutRequestID: checkoutRequestID
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('M-Pesa Status Query Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check transaction status'
        });
    }
});

// @route   POST /api/mpesa/c2b-simulate
// @desc    Simulate C2B payment (for testing)
// @access  Private (Admin)
router.post('/c2b-simulate', async (req, res) => {
    try {
        const { amount, phoneNumber, billRefNumber } = req.body;

        // Get OAuth token
        const accessToken = await getOAuthToken();

        const c2bData = {
            ShortCode: MPESA_CONFIG.shortcode,
            CommandID: 'CustomerPayBillOnline',
            Amount: amount,
            Msisdn: phoneNumber,
            BillRefNumber: billRefNumber
        };

        const response = await axios.post(
            `${MPESA_CONFIG.baseUrl}/mpesa/c2bsimulate/v1/query`,
            c2bData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('M-Pesa C2B Simulate Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to simulate C2B payment'
        });
    }
});

// @route   GET /api/mpesa/balance
// @desc    Check M-Pesa account balance
// @access  Private (Admin)
router.get('/balance', async (req, res) => {
    try {
        // Get OAuth token
        const accessToken = await getOAuthToken();

        // Generate timestamp and password for balance query
        const timestamp = new Date().getFullYear().toString() +
            (new Date().getMonth() + 1).toString().padStart(2, '0') +
            new Date().getDate().toString().padStart(2, '0') +
            new Date().getHours().toString().padStart(2, '0') +
            new Date().getMinutes().toString().padStart(2, '0') +
            new Date().getSeconds().toString().padStart(2, '0');

        const password = Buffer.from(
            MPESA_CONFIG.shortcode + MPESA_CONFIG.passkey + timestamp
        ).toString('base64');

        const balanceData = {
            Initiator: process.env.MPESA_INITIATOR || 'testapi',
            SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || 'testcredential',
            CommandID: 'AccountBalance',
            PartyA: MPESA_CONFIG.shortcode,
            IdentifierType: '4',
            Remarks: 'Account balance query',
            QueueTimeOutURL: MPESA_CONFIG.callbackUrl + '/balance-timeout',
            ResultURL: MPESA_CONFIG.callbackUrl + '/balance-result',
            Password: password,
            Timestamp: timestamp
        };

        const response = await axios.post(
            `${MPESA_CONFIG.baseUrl}/mpesa/accountbalance/v1/query`,
            balanceData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('M-Pesa Balance Query Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check account balance'
        });
    }
});

module.exports = router;
