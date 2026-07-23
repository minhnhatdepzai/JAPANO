// Khởi tạo client Stripe (test mode) một lần duy nhất — dùng chung cho webhook
// (server.js) và mọi route thanh toán Stripe.
const Stripe = require('stripe');

const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_PUBLISHABLE_KEY = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
const STRIPE_API_VERSION = String(process.env.STRIPE_API_VERSION || '2026-06-24.dahlia').trim();
const STRIPE_MERCHANT_DISPLAY_NAME = String(process.env.STRIPE_MERCHANT_DISPLAY_NAME || 'JAPANO Store').trim();
const STRIPE_WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION }) : null;

function stripeEnabled() {
  return Boolean(stripe && STRIPE_SECRET_KEY.startsWith('sk_test_') && STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_'));
}

module.exports = { stripe, stripeEnabled, STRIPE_PUBLISHABLE_KEY, STRIPE_MERCHANT_DISPLAY_NAME, STRIPE_WEBHOOK_SECRET };
