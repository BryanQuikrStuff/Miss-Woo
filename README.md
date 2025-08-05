# Miss-Woo

A WooCommerce integration plugin for Missive that provides order management and tracking capabilities directly in your email client.

## Features

- 🔍 **Order Search**: Search orders by ID or customer email
- 📦 **Tracking Information**: Automatic tracking number extraction and carrier detection
- 📊 **Order Management**: View order details, status, and customer information
- 🔗 **WooCommerce Integration**: Direct links to WooCommerce admin
- 📱 **Missive Ready**: Optimized for Missive iframe sidebar

## Setup

### 1. Backend API Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your WooCommerce API credentials in `config/api.js`

3. Deploy the backend API to your hosting provider (Heroku, Railway, etc.)

### 2. Frontend Setup

The frontend is now static and ready for deployment:

- `index.html` - Main entry point for Missive iframe
- `app.js` - Frontend application logic
- `styles.css` - Clean, responsive styling

### 3. Update API URL

In `app.js`, update the `apiBaseUrl` to point to your deployed backend:

```javascript
this.apiBaseUrl = 'https://your-deployed-api.com/api';
```

## Deployment

### Static Hosting (Recommended)

Deploy the static files to any static hosting service:

**Netlify:**
1. Connect your repository
2. Set build command: `echo "Static files ready"`
3. Set publish directory: `.` (root)

**Vercel:**
1. Connect your repository
2. Vercel will auto-detect static files

**AWS S3 + CloudFront:**
1. Upload files to S3 bucket
2. Configure CloudFront distribution

**GitHub Pages:**
1. Push to `gh-pages` branch
2. Enable GitHub Pages in repository settings

### Missive Integration

1. In Missive, go to Settings → Integrations
2. Add a new iframe integration
3. Set the URL to your deployed static site
4. Configure the iframe settings as needed

## File Structure

```
Miss-Woo/
├── index.html          # Missive iframe entry point
├── app.js             # Frontend application logic
├── styles.css         # Responsive styling
├── index.js           # Backend API server
├── lib/
│   ├── woocommerce.js # WooCommerce API client
│   └── tracking.js    # Tracking utility functions
├── config/
│   └── api.js         # API configuration
└── package.json       # Dependencies
```

## API Endpoints

- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get specific order with tracking
- `GET /api/orders/tracking/all` - Get all orders with tracking info
- `GET /api/products` - Get all products
- `GET /api/orders/:id/link` - Get WooCommerce admin link

## Security

⚠️ **Important**: Never commit your `config/api.js` file to version control. Add it to `.gitignore` and use environment variables in production.

## Support

For issues or questions, please check the API logs and ensure your WooCommerce API credentials are correctly configured.