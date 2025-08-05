const express = require('express');
const cors = require('cors');
const WooCommerceAPI = require('./lib/woocommerce');
const TrackingUtility = require('./lib/tracking');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize WooCommerce API
const wooCommerce = new WooCommerceAPI();

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Miss-Woo WooCommerce API Server' });
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await wooCommerce.getProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await wooCommerce.getProduct(req.params.id);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await wooCommerce.getOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific order (enhanced with tracking)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await wooCommerce.getOrder(req.params.id);
    const orderNotes = await wooCommerce.getOrderNotes(req.params.id);
    
    // Add tracking information to the order
    const trackingInfo = TrackingUtility.extractTrackingInfo(order, orderNotes);
    order.tracking = trackingInfo;
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tracking information for a specific order
app.get('/api/orders/:id/tracking', async (req, res) => {
  try {
    const order = await wooCommerce.getOrder(req.params.id);
    const orderNotes = await wooCommerce.getOrderNotes(req.params.id);
    const trackingInfo = TrackingUtility.extractTrackingInfo(order, orderNotes);
    
    res.json({
      order_id: order.id,
      order_status: order.status,
      customer: {
        name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
        email: order.billing?.email
      },
      tracking: trackingInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders with tracking information
app.get('/api/orders/tracking/all', async (req, res) => {
  try {
    const orders = await wooCommerce.getOrders();
    
    const ordersWithTracking = orders.map(order => {
      const trackingInfo = TrackingUtility.extractTrackingInfo(order);
      return {
        id: order.id,
        status: order.status,
        total: order.total,
        date_created: order.date_created,
        customer: {
          name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
          email: order.billing?.email
        },
        tracking: trackingInfo
      };
    });
    
    res.json(ordersWithTracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order notes for a specific order
app.get('/api/orders/:id/notes', async (req, res) => {
  try {
    const notes = await wooCommerce.getOrderNotes(req.params.id);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get WooCommerce order link
app.get('/api/orders/:id/link', async (req, res) => {
  try {
    const config = require('./config/api');
    const orderId = req.params.id;
    const wooCommerceUrl = `${config.siteUrl}/wp-admin/post.php?post=${orderId}&action=edit`;
    
    res.json({
      order_id: orderId,
      woo_commerce_url: wooCommerceUrl,
      message: 'Click the link to open the order in WooCommerce admin'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Miss-Woo server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
}); 