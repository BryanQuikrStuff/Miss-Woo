# WooCommerce Orders Integration for Missive

A powerful iframe integration that displays WooCommerce order data directly within Missive conversations. When you select a conversation, the integration automatically fetches and displays all orders associated with the sender's email address.

## Features

- **Automatic Order Lookup**: Extracts email addresses from conversation senders and fetches corresponding WooCommerce orders
- **Comprehensive Order Display**: Shows order ID, date, total, status, and detailed breakdowns
- **Detailed Order View**: Click any order to see line items, shipping address, and tracking information
- **Smart Caching**: Uses Missive's storage API to cache order data and reduce API calls
- **Multiple UI States**: Handles loading, errors, multiple conversations, and no orders scenarios
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Automatically refreshes when conversation selection changes

## File Structure

```
├── index.html          # Main iframe page with Missive API integration
├── app.js             # Core JavaScript logic for Missive events and WooCommerce API
├── styles.css         # Custom styling that builds upon Missive base styles
└── README.md          # Setup and usage documentation
```

## Setup Instructions

### 1. WooCommerce Configuration

First, you need to generate API credentials in your WooCommerce store:

1. Go to **WooCommerce → Settings → Advanced → REST API**
2. Click **Add Key**
3. Set these options:
   - **Description**: "Missive Integration"
   - **User**: Select an administrator user
   - **Permissions**: "Read"
4. Click **Generate API Key**
5. Copy the **Consumer Key** and **Consumer Secret**

### 2. Integration Configuration

Edit the `app.js` file and update the `WOOCOMMERCE_CONFIG` object:

```javascript
const WOOCOMMERCE_CONFIG = {
    baseUrl: 'https://your-store.com',           // Your WooCommerce store URL
    consumerKey: 'ck_your_consumer_key',         // Your Consumer Key
    consumerSecret: 'cs_your_consumer_secret',   // Your Consumer Secret
    apiVersion: 'v3'                             // WooCommerce API version
};
```

### 3. Host the Files

Upload all files to a web server that supports HTTPS. The integration must be served over HTTPS to work within Missive.

### 4. Add to Missive

1. In Missive, go to **Settings → Integrations**
2. Click **Add Integration**
3. Choose **iframe**
4. Set the URL to your hosted `index.html` file
5. Configure the iframe size (recommended: 800px wide, 600px height)

## Key Functions

### Core Integration Functions

- **`initMissive()`**: Initializes the Missive API connection and event listeners
- **`handleConversationChange()`**: Responds to conversation selection changes
- **`extractEmailFromConversation()`**: Extracts sender email from conversation data

### WooCommerce API Functions

- **`fetchOrdersByEmail(email)`**: Queries WooCommerce REST API for orders by email
- **`fetchOrderDetails(orderId)`**: Retrieves detailed information for a specific order
- **`extractTrackingInfo(order)`**: Extracts tracking data from order metadata

### UI Management Functions

- **`renderOrdersList(orders)`**: Displays the orders list in the left panel
- **`renderOrderDetails(order)`**: Shows detailed order information in the right panel
- **`handleOrderClick(orderId)`**: Handles order selection and detail loading

### Caching Functions

- **`cacheOrders(email, orders)`**: Stores order data using Missive's storage API
- **`getCachedOrders(email)`**: Retrieves cached order data if available and fresh

## User Interface

### Left Panel - Orders List
- Displays all orders for the selected email
- Shows Order ID, date, total amount, and status
- Color-coded status badges for quick identification
- Click any order to view details

### Right Panel - Order Details
- Comprehensive order information
- Line items with names, SKUs, quantities, and totals
- Customer shipping address
- Tracking information (if available)
- Order totals and status

### State Management
- **Loading State**: Shows spinner while fetching data
- **Error State**: Displays error messages with retry option
- **Multiple Conversations**: Prompts user to select single conversation
- **No Orders**: Informs when no orders are found for an email

## Customization

### Tracking Information

The `extractTrackingInfo()` function can be customized based on how your WooCommerce store handles tracking data:

```javascript
function extractTrackingInfo(order) {
    // Check for tracking in order meta_data
    if (order.meta_data && order.meta_data.length > 0) {
        const trackingMeta = order.meta_data.find(meta => 
            meta.key === '_tracking_number' || // Adjust key name
            meta.key === '_shipment_tracking'
        );
        
        if (trackingMeta) {
            return {
                number: trackingMeta.value,
                carrier: 'Your Carrier Name',
                status: order.status
            };
        }
    }
    
    return null;
}
```

### Cache Duration

Modify the cache duration in `app.js`:

```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (adjust as needed)
```

### Styling

The integration uses a responsive design that adapts to different screen sizes. You can customize colors, fonts, and layout by modifying `styles.css`.

## API Rate Limiting

The integration includes smart caching to minimize API calls:

- Order data is cached for 5 minutes per email address
- Only fresh API calls are made when cache expires
- Error handling includes retry mechanisms

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your WooCommerce store allows cross-origin requests from your integration domain
2. **Authentication Failures**: Verify your Consumer Key and Consumer Secret are correct
3. **No Orders Displayed**: Check that the email extraction is working and orders exist for that email
4. **Missive API Errors**: Ensure the integration is loaded within a Missive iframe context

### Debug Mode

Enable console logging by opening browser developer tools. The integration logs all major actions and API calls.

### Error Messages

The integration provides user-friendly error messages and includes a retry mechanism for failed API calls.

## Security Considerations

- Use HTTPS for hosting the integration
- Store API credentials securely (consider environment variables for production)
- WooCommerce API keys should have minimal required permissions (Read-only)
- The integration only accesses order data, not sensitive customer information

## Browser Compatibility

- Modern browsers supporting ES6+ features
- Tested on Chrome, Firefox, Safari, and Edge
- Mobile-responsive design for tablet and phone access

## Support

For issues related to:
- **WooCommerce API**: Check WooCommerce REST API documentation
- **Missive Integration**: Refer to Missive's iframe integration docs
- **This Integration**: Review console logs and error messages for debugging information

## License

This integration is provided as-is for educational and commercial use. Modify as needed for your specific requirements.