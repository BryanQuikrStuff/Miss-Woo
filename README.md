# Missive WooCommerce Orders Integration

A lightweight iframe integration for Missive that displays WooCommerce order information for email senders. This plugin connects to the WooCommerce REST API to fetch and display order details directly within Missive conversations.

## Features

- **Real-time Integration**: Automatically detects conversation changes in Missive
- **Email-based Order Lookup**: Queries WooCommerce orders by sender email address
- **Order List View**: Displays order ID, date, total, and status in a clean list
- **Detailed Order View**: Shows complete order details including items, quantities, shipping info, and tracking
- **Caching**: Implements intelligent caching to reduce API calls
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Graceful error states with retry functionality
- **Loading States**: Clear loading indicators for better UX

## File Structure

```
├── index.html          # Main HTML structure
├── app.js             # Core application logic
├── styles.css         # Custom styling
└── README.md         # This documentation
```

## Setup Instructions

### 1. WooCommerce API Configuration

First, you need to set up WooCommerce REST API credentials:

1. **Generate API Keys**:
   - Go to your WooCommerce admin panel
   - Navigate to **WooCommerce → Settings → Advanced → REST API**
   - Click **Add Key**
   - Set permissions to **Read/Write**
   - Generate the key and note down the Consumer Key and Consumer Secret

2. **Update Configuration**:
   - Open `app.js`
   - Update the `WOOCOMMERCE_CONFIG` object with your store details:

```javascript
const WOOCOMMERCE_CONFIG = {
    baseUrl: 'https://your-store.com', // Your WooCommerce store URL
    consumerKey: 'ck_your_consumer_key', // Your consumer key
    consumerSecret: 'cs_your_consumer_secret', // Your consumer secret
    apiVersion: 'v3'
};
```

### 2. Hosting Setup

The plugin needs to be hosted on a static HTTPS server. You can use:

- **GitHub Pages**: Upload files to a GitHub repository and enable Pages
- **Netlify**: Drag and drop the files to deploy
- **Vercel**: Connect your repository for automatic deployment
- **Any static hosting service**: The files are completely static

### 3. Missive Integration

1. **Add to Missive**:
   - Open Missive settings
   - Go to **Integrations → Custom Integrations**
   - Click **Add Integration**
   - Enter a name (e.g., "WooCommerce Orders")
   - Set the URL to your hosted `index.html` file
   - Save the integration

2. **Configure Permissions**:
   - Ensure the integration has access to conversation data
   - The plugin uses the Missive JavaScript API to read conversation information

## How It Works

### Conversation Detection
- The plugin listens for conversation changes using `Missive.on('change:conversations')`
- When a conversation is selected, it extracts the sender's email address
- Supports both single and multiple conversation selection

### Email Extraction
The plugin extracts email addresses from:
- The `from_field.address` in the latest message
- Contact email addresses in the conversation

### Order Fetching
- Queries WooCommerce REST API using the email address
- Implements intelligent caching (5-minute cache duration)
- Handles API rate limiting and errors gracefully

### Data Display
- **Orders List**: Shows order ID, date, total, and status
- **Order Details**: Displays complete order information including:
  - Line items with quantities and prices
  - Shipping address
  - Tracking information (if available)
  - Order totals and status

## API Endpoints Used

The plugin uses these WooCommerce REST API endpoints:

- `GET /wp-json/wc/v3/orders` - Fetch orders by email
- `GET /wp-json/wc/v3/orders/{id}` - Get detailed order information

## Customization

### Styling
- Modify `styles.css` to match your brand colors
- The plugin uses Missive's base CSS for consistency
- Responsive design included for mobile devices

### Order Status Colors
Update the status colors in `styles.css`:

```css
.order-status.status-completed { /* Green */ }
.order-status.status-processing { /* Yellow */ }
.order-status.status-pending { /* Orange */ }
.order-status.status-cancelled { /* Red */ }
.order-status.status-refunded { /* Gray */ }
```

### Tracking Information
The plugin attempts to extract tracking information from:
- Order meta data (looks for keys containing "tracking" or "shipment")
- Shipping line meta data

Customize the `extractTrackingInfo()` function in `app.js` based on your tracking setup.

### Cache Duration
Modify the cache duration in `app.js`:

```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

## Error Handling

The plugin handles various error scenarios:

- **No conversation selected**: Shows appropriate message
- **Multiple conversations**: Prompts user to select single conversation
- **No orders found**: Displays "No Orders Found" message
- **API errors**: Shows error message with retry button
- **Network issues**: Graceful fallback with user-friendly messages

## Security Considerations

- **API Credentials**: Store credentials securely, never expose them in client-side code for production
- **HTTPS Required**: The plugin must be hosted on HTTPS for Missive integration
- **CORS**: Ensure your WooCommerce site allows requests from your hosting domain
- **Rate Limiting**: The plugin includes basic rate limiting through caching

## Troubleshooting

### Common Issues

1. **Orders not loading**:
   - Check WooCommerce API credentials
   - Verify the store URL is correct
   - Ensure the email address is being extracted properly

2. **CORS errors**:
   - Add your hosting domain to WooCommerce CORS settings
   - Check browser console for specific error messages

3. **Missive integration not working**:
   - Verify the URL is accessible via HTTPS
   - Check Missive integration permissions
   - Ensure the Missive JavaScript API is loading

### Debug Mode

Enable console logging by checking the browser's developer tools. The plugin includes extensive logging for debugging.

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify WooCommerce API credentials
3. Test the API endpoints directly
4. Review the Missive integration documentation

## Changelog

### Version 1.0.0
- Initial release
- Basic order listing and details
- Missive iframe integration
- WooCommerce REST API integration
- Responsive design
- Error handling and caching