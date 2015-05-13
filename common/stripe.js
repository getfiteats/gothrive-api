var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

stripe.statusMap = {
  "succeeded": "paid",
  "failed": "failed"
};

module.exports = stripe;