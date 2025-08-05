# Miss-Woo

A WooCommerce integration app for Missive that provides order management and tracking capabilities directly in your email client.

## Features

- 🔍 **Order Search**: Search orders by ID or customer email
- 📦 **Tracking Information**: Automatic tracking number extraction and carrier detection
- 📊 **Order Management**: View order details, status, and customer information
- 🔗 **WooCommerce Integration**: Direct links to WooCommerce admin
- 📱 **Missive Ready**: Optimized for Missive iframe sidebar

## Setup

### 1. Environment Configuration

1. Create a `.env` file in the root directory:
   ```env
   WOOCOMMERCE_CONSUMER_KEY=your_consumer_key
   WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret
   WOOCOMMERCE_SITE_URL=your_site_url
   WOOCOMMERCE_API_VERSION=wc/v3
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### 2. Development

Run tests:
```bash
npm test
```

The frontend application is static and consists of:
- `index.html` - Main entry point for Missive iframe
- `src/app.js` - Frontend application logic
- `src/styles.css` - Clean, responsive styling
- `src/woocommerce.js` - WooCommerce API integration
- `src/tracking.js` - Order tracking functionality

### 3. Update API URL

In `src/app.js`, update the `apiBaseUrl` to point to your WooCommerce site:

```javascript
this.apiBaseUrl = 'https://your-woocommerce-site.com/wp-json/wc/v3';
```

## Project Structure

```
Miss-Woo/
├── .github/          # GitHub Actions configuration
├── __tests__/        # Test files
├── config/           # API configuration
├── src/             # Source files
│   ├── app.js       # Main application logic
│   ├── styles.css   # Styles
│   ├── tracking.js  # Tracking functionality
│   └── woocommerce.js # WooCommerce API integration
├── .env             # Environment variables (not in git)
├── .gitignore       # Git ignore rules
├── index.html       # Main HTML file
├── package.json     # Project dependencies
└── README.md        # Project documentation
```

## Missive Integration

1. In Missive, go to Settings → Integrations
2. Add a new iframe integration
3. Set the URL to your deployed static site
4. Configure the iframe settings as needed

## Available Features

### Order Management
- Search orders by ID or email
- View recent orders
- Track order status
- View customer information
- Access order details

### Tracking Integration
- View tracking numbers
- Track packages
- Monitor shipping status
- Access carrier information

### WooCommerce Integration
- Direct links to WooCommerce admin
- Real-time order data
- Secure API integration
- Test connection functionality

## Security

⚠️ **Important Security Notes**:
1. Never commit your `.env` file to version control
2. Keep your WooCommerce API credentials secure
3. Use HTTPS for all API communications
4. Regularly update dependencies with `npm audit`

## Development Guidelines

1. **Code Style**
   - Use ESLint for code quality
   - Follow the existing code structure
   - Add comments for complex logic

2. **Testing**
   - Write tests for new features
   - Run tests before commits
   - Maintain test coverage

3. **Git Workflow**
   - Use feature branches
   - Follow conventional commits
   - Keep PRs focused and small

## Support

For issues or questions:
1. Check the console logs
2. Verify WooCommerce API credentials
3. Ensure proper environment configuration
4. Test API connectivity

## License

MIT License - See LICENSE file for details