const axios = require('axios');
const config = require('../config/api');

class WooCommerceAPI {
  constructor() {
    this.baseURL = config.siteUrl;
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.apiVersion = config.apiVersion;
    
    // Create axios instance with basic auth
    this.client = axios.create({
      baseURL: `${this.baseURL}/wp-json/${this.apiVersion}`,
      auth: {
        username: this.consumerKey,
        password: this.consumerSecret
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Get all products
  async getProducts(params = {}) {
    try {
      const response = await this.client.get('/products', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  // Get a specific product
  async getProduct(productId) {
    try {
      const response = await this.client.get(`/products/${productId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch product ${productId}: ${error.message}`);
    }
  }

  // Create a new product
  async createProduct(productData) {
    try {
      const response = await this.client.post('/products', productData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create product: ${error.message}`);
    }
  }

  // Update a product
  async updateProduct(productId, productData) {
    try {
      const response = await this.client.put(`/products/${productId}`, productData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update product ${productId}: ${error.message}`);
    }
  }

  // Delete a product
  async deleteProduct(productId) {
    try {
      const response = await this.client.delete(`/products/${productId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete product ${productId}: ${error.message}`);
    }
  }

  // Get all orders
  async getOrders(params = {}) {
    try {
      const response = await this.client.get('/orders', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }
  }

  // Get a specific order
  async getOrder(orderId) {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch order ${orderId}: ${error.message}`);
    }
  }

  // Create a new order
  async createOrder(orderData) {
    try {
      const response = await this.client.post('/orders', orderData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  // Update an order
  async updateOrder(orderId, orderData) {
    try {
      const response = await this.client.put(`/orders/${orderId}`, orderData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update order ${orderId}: ${error.message}`);
    }
  }

  // Get all customers
  async getCustomers(params = {}) {
    try {
      const response = await this.client.get('/customers', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }
  }

  // Get a specific customer
  async getCustomer(customerId) {
    try {
      const response = await this.client.get(`/customers/${customerId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch customer ${customerId}: ${error.message}`);
    }
  }

  // Test API connection
  async testConnection() {
    try {
      const response = await this.client.get('/products');
      return {
        success: true,
        message: 'WooCommerce API connection successful',
        productCount: response.data.length
      };
    } catch (error) {
      return {
        success: false,
        message: `WooCommerce API connection failed: ${error.message}`
      };
    }
  }

  // Get order notes
  async getOrderNotes(orderId) {
    try {
      const response = await this.client.get(`/orders/${orderId}/notes`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch order notes for order ${orderId}: ${error.message}`);
    }
  }
}

module.exports = WooCommerceAPI;