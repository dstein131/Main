// routes/payments.routes.js
const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Route to create a payment intent
router.post('/create-payment-intent', authenticateJWT, paymentsController.createPaymentIntent);

// Stripe Webhook to handle payment events
router.post('/webhook', express.raw({ type: 'application/json' }), paymentsController.handleWebhook);

module.exports = router;
