// Sign-in for returning buyers. It used to accept an email alone, which let anyone
// who knew a buyer's address claim their purchase. It now takes the checkout email
// and the receipt's order number together, exactly like /api/verify-subscription,
// so both routes share that handler.
module.exports = require('./verify-subscription');
