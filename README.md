# WooCommerce Orders - Missive Integration

A lightweight iframe integration that displays WooCommerce customer orders directly within Missive conversations. When you select a conversation, the plugin automatically detects the customer's email and displays their order history with detailed information.

## Features

- 🔄 **Automatic Email Detection**: Extracts customer email from conversation participants
- 📋 **Order List View**: Shows order ID, date, status, and total amount
- 🔍 **Detailed Order View**: Click any order to see full details including items, shipping, and totals
- 🎨 **Clean UI**: Modern, responsive design that fits seamlessly in Missive
- ⚡ **Real-time Updates**: Watches for conversation changes and updates automatically
- 🛡️ **Error Handling**: Graceful error states with retry functionality
- 📱 **Mobile Responsive**: Works well on all screen sizes

## Setup Instructions

### 1. WooCommerce API Configuration

First, you need to create API credentials in your WooCommerce store:

1. Go to your WordPress admin → **WooCommerce** → **Settings** → **Advanced** → **REST API**
2. Click **Add Key**
3. Set the following:
   - **Description**: `Missive Integration`
   - **User**: Select an administrator user
   - **Permissions**: `Read`
4. Click **Generate API Key**
5. Copy the **Consumer Key** and **Consumer Secret** (you'll need these for configuration)

### 2. Plugin Configuration

The plugin supports multiple configuration methods:

#### Method 1: Environment Variables (Recommended for hosting)
Set these environment variables in your hosting environment:
```bash
WOOCOMMERCE_URL=https://quikrstuff.com
WOOCOMMERCE_KEY=ck_285852a66ac9cf16db7723e1d6deda54937a8a03
WOOCOMMERCE_SECRET=cs_3211f905108b717426e6b6a63613147b66993333
```

#### Method 2: Local Storage (For development/testing)
The plugin will check browser localStorage for:
- `woo_base_url`
- `woo_consumer_key`
- `woo_consumer_secret`

You can set these manually in browser console:
```javascript
localStorage.setItem('woo_base_url', 'https://quikrstuff.com');
localStorage.setItem('woo_consumer_key', 'ck_285852a66ac9cf16db7723e1d6deda54937a8a03');
localStorage.setItem('woo_consumer_secret', 'cs_3211f905108b717426e6b6a63613147b66993333');
```

#### Method 3: PostMessage Configuration
Send configuration via postMessage (useful for parent iframe management):
```javascript
window.postMessage({
    type: 'woocommerce-config',
    baseUrl: 'https://quikrstuff.com',
    consumerKey: 'ck_285852a66ac9cf16db7723e1d6deda54937a8a03',
    consumerSecret: 'cs_3211f905108b717426e6b6a63613147b66993333'
}, '*');
```

### 3. Hosting the Plugin

#### Option A: Static HTTPS Host
1. Upload all files (`index.html`, `app.js`, `styles.css`) to your HTTPS web server
2. Ensure CORS is configured to allow requests from Missive domains
3. Configure your WooCommerce credentials using one of the methods above

#### Option B: GitHub Pages (Free hosting)
1. Create a new GitHub repository
2. Upload the plugin files to the repository
3. Enable GitHub Pages in repository settings
4. Use the provided HTTPS URL for the Missive integration

### 4. Adding to Missive

1. Open Missive and go to **Settings** → **Integrations**
2. Click **Add Integration** → **Custom iframe**
3. Set the **URL** to your hosted plugin location
4. Configure the integration name and icon as desired
5. Save the integration

## Usage

1. **Select a Conversation**: Choose any conversation in Missive
2. **Automatic Detection**: The plugin will automatically detect the customer's email
3. **View Orders**: Browse the customer's order history in a clean list view
4. **Order Details**: Click any order to see full details including:
   - Order items with quantities and prices
   - Shipping address
   - Payment method
   - Order totals and taxes

## File Structure

```
├── index.html          # Main HTML structure with Missive resources
├── app.js             # JavaScript application with API integration
├── styles.css         # Modern, responsive CSS styling
└── README.md          # This file
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Security Notes

- ✅ Uses HTTPS for all API communications
- ✅ Implements proper CORS handling
- ✅ Uses basic authentication for WooCommerce API
- ✅ No sensitive data stored in browser (except localStorage for dev)
- ⚠️ Store API credentials securely - never commit them to public repositories

## Troubleshooting

### "WooCommerce configuration required"
- Verify your API credentials are set correctly
- Check that your WooCommerce store URL is accessible
- Ensure API credentials have at least "Read" permissions

### "WooCommerce authentication failed"
- Double-check your Consumer Key and Consumer Secret
- Verify the API key is active in WooCommerce settings
- Ensure your WooCommerce store has REST API enabled

### "No customer email found"
- Verify the conversation has messages with valid email addresses
- Check that conversation participants include customer emails
- Try selecting a different conversation

### Orders not loading
- Check browser console for error messages
- Verify CORS is properly configured on your WooCommerce store
- Ensure the customer email exists in your WooCommerce customer database

## Development

To modify or extend the plugin:

1. **Clone/download** the files
2. **Edit** `app.js` for functionality changes
3. **Modify** `styles.css` for styling updates
4. **Test** in a development environment first
5. **Deploy** to your production hosting

### Key Classes and Methods

- `WooCommerceOrdersApp`: Main application class
- `handleConversationChange()`: Processes Missive conversation updates
- `fetchWooCommerceOrders()`: Retrieves orders from WooCommerce API
- `renderOrderDetails()`: Displays detailed order information

## API Integration

### Missive API Usage
- `Missive.on('change:conversations')`: Listens for conversation changes
- `Missive.fetch('conversations')`: Gets current conversation data

### WooCommerce REST API Endpoints
- `GET /wp-json/wc/v3/orders`: Retrieves orders by customer email
- `GET /wp-json/wc/v3/orders/{id}`: Gets detailed order information

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify your WooCommerce API configuration
4. Test with a simple REST API client to isolate issues