// config/stripe.js

const Stripe = require('stripe');

// Validate that STRIPE_SECRET_KEY is set
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables.');
}

// Initialize Stripe with your Secret Key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = stripe;
