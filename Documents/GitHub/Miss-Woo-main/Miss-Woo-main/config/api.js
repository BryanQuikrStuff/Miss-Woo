require('dotenv').config();

const config = {
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  siteUrl: process.env.WOOCOMMERCE_SITE_URL,
  apiVersion: process.env.WOOCOMMERCE_API_VERSION || 'wc/v3'
};

module.exports = config;