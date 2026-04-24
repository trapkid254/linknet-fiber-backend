// routes/payments.js - M-Pesa Payment Routes
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Daraja Sandbox Credentials
const DARAJA_CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY || 'YourConsumerKey';
const DARAJA_CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET || 'YourConsumerSecret';
const DARAJA_PASSKEY = process.env.DARAJA_PASSKEY || 'YourPassKey';
const DARAJA_SHORTCODE = process.env.DARAJA_SHORTCODE || '174379';
const DARAJA_ENV = process.env.DARAJA_ENV || 'sandbox'; // sandbox or production

// Get Daraja Access Token
async function getAccessToken() {
    try {
        const auth = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString('base64');
        
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            }
        );
        
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw new Error('Failed to get access token');
    }
}

/**
 * @route   POST /api/payments/mpesa/stkpush
 * @desc    Initiate M-Pesa STK Push payment
 * @access  Private
 */
router.post('/mpesa/stkpush', async (req, res) => {
    try {
        const { amount, phoneNumber, accountReference, transactionDesc } = req.body;
        
        // Validate input
        if (!amount || !phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Amount and phone number are required'
            });
        }

        // Format phone number (ensure it starts with 254)
        let formattedPhone = phoneNumber.replace(/\s/g, '');
        if (formattedPhone.startsWith('07')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('254')) {
            // Already formatted
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Use 07XX XXX XXX or 2547XX XXX XXX'
            });
        }

        // Get access token
        const accessToken = await getAccessToken();

        // Generate timestamp
        const date = new Date();
        const timestamp = date.getFullYear() +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            ('0' + date.getDate()).slice(-2) +
            ('0' + date.getHours()).slice(-2) +
            ('0' + date.getMinutes()).slice(-2) +
            ('0' + date.getSeconds()).slice(-2);

        // Generate password
        const password = Buffer.from(DARAJA_SHORTCODE + DARAJA_PASSKEY + timestamp).toString('base64');

        // STK Push payload
        const stkPushPayload = {
            'BusinessShortCode': DARAJA_SHORTCODE,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': 'CustomerPayBillOnline',
            'Amount': amount,
            'PartyA': formattedPhone,
            'PartyB': DARAJA_SHORTCODE,
            'PhoneNumber': formattedPhone,
            'CallBackURL': 'https://your-domain.com/api/payments/mpesa/callback',
            'AccountReference': accountReference || 'Linknet Fiber',
            'TransactionDesc': transactionDesc || 'Payment'
        };

        // Make STK Push request
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            stkPushPayload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            message: 'Payment initiated successfully',
            merchantRequestID: response.data.MerchantRequestID,
            checkoutRequestID: response.data.CheckoutRequestID,
            responseCode: response.data.ResponseCode,
            responseDescription: response.data.ResponseDescription
        });

    } catch (error) {
        console.error('STK Push error:', error.response ? error.response.data : error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errorMessage || 'Failed to initiate payment'
        });
    }
});

/**
 * @route   POST /api/payments/mpesa/callback
 * @desc    M-Pesa STK Push callback
 * @access  Public
 */
router.post('/mpesa/callback', async (req, res) => {
    try {
        const { Body } = req.body;
        
        console.log('M-Pesa Callback received:', Body);
        
        const resultCode = Body.stkCallback.ResultCode;
        const resultDesc = Body.stkCallback.ResultDesc;
        const merchantRequestID = Body.stkCallback.MerchantRequestID;
        const checkoutRequestID = Body.stkCallback.CheckoutRequestID;
        
        if (resultCode === 0) {
            // Payment successful
            const callbackMetadata = Body.stkCallback.CallbackMetadata.Item;
            const amount = callbackMetadata.find(item => item.Name === 'Amount').Value;
            const mpesaReceipt = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber').Value;
            const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate').Value;
            const phoneNumber = callbackMetadata.find(item => item.Name === 'PhoneNumber').Value;
            
            console.log('Payment successful:', {
                amount,
                mpesaReceipt,
                transactionDate,
                phoneNumber,
                merchantRequestID,
                checkoutRequestID
            });
            
            // TODO: Save payment to database
            // TODO: Update client billing status
            
        } else {
            // Payment failed
            console.log('Payment failed:', resultDesc);
        }
        
        // Respond to Safaricom
        res.json({
            ResultCode: 0,
            ResultDesc: 'Success'
        });
        
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({
            ResultCode: 1,
            ResultDesc: 'Error processing callback'
        });
    }
});

/**
 * @route   GET /api/payments/mpesa/query/:checkoutRequestID
 * @desc    Query STK Push status
 * @access  Private
 */
router.get('/mpesa/query/:checkoutRequestID', async (req, res) => {
    try {
        const { checkoutRequestID } = req.params;
        
        const accessToken = await getAccessToken();
        
        const date = new Date();
        const timestamp = date.getFullYear() +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            ('0' + date.getDate()).slice(-2) +
            ('0' + date.getHours()).slice(-2) +
            ('0' + date.getMinutes()).slice(-2) +
            ('0' + date.getSeconds()).slice(-2);

        const password = Buffer.from(DARAJA_SHORTCODE + DARAJA_PASSKEY + timestamp).toString('base64');

        const queryPayload = {
            'BusinessShortCode': DARAJA_SHORTCODE,
            'Password': password,
            'Timestamp': timestamp,
            'CheckoutRequestID': checkoutRequestID
        };

        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
            queryPayload,
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
        console.error('Query error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to query payment status'
        });
    }
});

module.exports = router;
