const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * Process a payment using Stripe
 * @param {Object} paymentData - Payment information
 * @param {Number} paymentData.amount - Amount in smallest currency unit (e.g. cents)
 * @param {String} paymentData.currency - Currency code (e.g. 'usd')
 * @param {String} paymentData.paymentMethodId - Stripe payment method ID
 * @param {String} paymentData.customerId - Stripe customer ID
 * @param {String} paymentData.description - Payment description
 * @returns {Promise} - Resolves to payment intent object
 */
exports.processPayment = async (paymentData) => {
  try {
    const { amount, currency, paymentMethodId, customerId, description } =
      paymentData;

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents or smallest currency unit
      currency: currency || "usd",
      payment_method: paymentMethodId,
      customer: customerId,
      description,
      confirm: true,
      return_url: process.env.PAYMENT_RETURN_URL,
    });

    return paymentIntent;
  } catch (error) {
    console.error("Payment processing error:", error);
    throw error;
  }
};

/**
 * Process a refund using Stripe
 * @param {String} paymentIntentId - Stripe payment intent ID to refund
 * @param {Number} amount - Amount to refund (optional, full refund if not specified)
 * @returns {Promise} - Resolves to refund object
 */
exports.processRefund = async (paymentIntentId, amount = null) => {
  try {
    const refundData = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents or smallest currency unit
    }

    const refund = await stripe.refunds.create(refundData);
    return refund;
  } catch (error) {
    console.error("Refund processing error:", error);
    throw error;
  }
};

/**
 * Create a Stripe customer
 * @param {Object} customerData - Customer information
 * @param {String} customerData.email - Customer email
 * @param {String} customerData.name - Customer name
 * @param {String} customerData.phone - Customer phone
 * @returns {Promise} - Resolves to customer object
 */
exports.createCustomer = async (customerData) => {
  try {
    const { email, name, phone } = customerData;

    const customer = await stripe.customers.create({
      email,
      name,
      phone,
    });

    return customer;
  } catch (error) {
    console.error("Customer creation error:", error);
    throw error;
  }
};

/**
 * Add a payment method to a customer
 * @param {String} customerId - Stripe customer ID
 * @param {String} paymentMethodId - Stripe payment method ID
 * @returns {Promise} - Resolves to payment method object
 */
exports.addPaymentMethod = async (customerId, paymentMethodId) => {
  try {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch (error) {
    console.error("Add payment method error:", error);
    throw error;
  }
};

/**
 * Create a Stripe Connect account for a restaurant or rider
 * @param {Object} accountData - Account information
 * @param {String} accountData.email - Account email
 * @param {String} accountData.country - Account country (ISO 3166-1 alpha-2 code)
 * @param {String} accountData.businessType - Business type (individual, company)
 * @param {Object} accountData.businessProfile - Business profile information
 * @returns {Promise} - Resolves to account object
 */
exports.createConnectAccount = async (accountData) => {
  try {
    const { email, country, businessType, businessProfile } = accountData;

    const account = await stripe.accounts.create({
      type: "express",
      email,
      country,
      business_type: businessType,
      business_profile: businessProfile,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return account;
  } catch (error) {
    console.error("Connect account creation error:", error);
    throw error;
  }
};

/**
 * Create an account link for Stripe Connect onboarding
 * @param {String} accountId - Stripe Connect account ID
 * @param {String} refreshUrl - URL to redirect on refresh
 * @param {String} returnUrl - URL to redirect on completion
 * @returns {Promise} - Resolves to account link object
 */
exports.createAccountLink = async (accountId, refreshUrl, returnUrl) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return accountLink;
  } catch (error) {
    console.error("Account link creation error:", error);
    throw error;
  }
};

/**
 * Transfer funds to a connected account (restaurant or rider)
 * @param {Object} transferData - Transfer information
 * @param {Number} transferData.amount - Amount to transfer
 * @param {String} transferData.currency - Currency code
 * @param {String} transferData.destination - Destination account ID
 * @param {String} transferData.description - Transfer description
 * @returns {Promise} - Resolves to transfer object
 */
exports.transferFunds = async (transferData) => {
  try {
    const { amount, currency, destination, description } = transferData;

    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: currency || "usd",
      destination,
      description,
    });

    return transfer;
  } catch (error) {
    console.error("Fund transfer error:", error);
    throw error;
  }
};
