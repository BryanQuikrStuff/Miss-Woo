# WooCommerce Orders - Missive Integration

A powerful iframe integration that displays QuikrStuff.com WooCommerce customer orders directly within Missive conversations. When you select a conversation, the plugin automatically detects the customer's email and displays their complete order history with detailed information.

## 🚀 Features

- 🔄 **Automatic Email Detection**: Extracts customer email from conversation participants
- 📋 **Order List View**: Shows order ID, date, status, and total amount with beautiful status badges
- 🔍 **Detailed Order View**: Click any order to see full details including items, quantities, shipping, and totals
- 🎨 **Clean UI**: Modern, responsive design that fits seamlessly in Missive's interface
- ⚡ **Real-time Updates**: Watches for conversation changes and updates automatically
- 🛡️ **Error Handling**: Graceful error states with retry functionality
- 📱 **Mobile Responsive**: Works perfectly on all screen sizes
- 🔒 **Secure**: Uses HTTPS and proper WooCommerce REST API authentication
- ⚙️ **Pre-configured**: Ready to use with QuikrStuff.com store out-of-the-box

## 📋 Setup Instructions

### 🎯 Quick Start (Pre-configured for QuikrStuff.com)

This plugin comes pre-configured with QuikrStuff.com store credentials and will work immediately after deployment. Simply:

1. **Deploy the files** to any HTTPS hosting service
2. **Add to Missive** using the hosted URL
3. **Start using** - select conversations to see customer orders!

### 🔧 Custom Configuration (Optional)

If you need to use a different WooCommerce store, you can override the default configuration:

#### WooCommerce API Setup
1. Go to your WordPress admin → **WooCommerce** → **Settings** → **Advanced** → **REST API**
2. Click **Add Key**
3. Set the following:
   - **Description**: `Missive Integration`
   - **User**: Select an administrator user
   - **Permissions**: `Read`
4. Click **Generate API Key**
5. Copy the **Consumer Key** and **Consumer Secret**

#### Configuration Methods

The plugin supports multiple configuration methods (only needed for custom stores):

**Method 1: Environment Variables** (Recommended for hosting)
```bash
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_KEY=your_consumer_key
WOOCOMMERCE_SECRET=your_consumer_secret
```

**Method 2: Local Storage** (For development/testing)
```javascript
localStorage.setItem('woo_base_url', 'https://your-store.com');
localStorage.setItem('woo_consumer_key', 'your_consumer_key');
localStorage.setItem('woo_consumer_secret', 'your_consumer_secret');
```

**Method 3: PostMessage** (For dynamic configuration)
```javascript
window.postMessage({
    type: 'woocommerce-config',
    baseUrl: 'https://your-store.com',
    consumerKey: 'your_consumer_key',
    consumerSecret: 'your_consumer_secret'
}, '*');
```

### 🏠 Current QuikrStuff.com Configuration

The plugin is pre-configured with these QuikrStuff.com credentials:
```bash
Store URL: https://quikrstuff.com
Consumer Key: ck_285852a66ac9cf16db7723e1d6deda54937a8a03
Consumer Secret: cs_3211f905108b717426e6b6a63613147b66993333
```

### 🚀 Deployment

#### Option A: GitHub Pages (Recommended - Free)
1. **Fork or create** a new GitHub repository
2. **Upload** all plugin files (`index.html`, `app.js`, `styles.css`, `README.md`)
3. **Enable GitHub Pages** in repository settings → Pages → Source: Deploy from branch → main
4. **Copy the HTTPS URL** provided by GitHub Pages
5. **Ready to use!** The plugin will work immediately with QuikrStuff.com

#### Option B: Static HTTPS Host
1. **Upload** all files to your HTTPS web server
2. **Ensure CORS** is configured (if needed)
3. **Test access** to the index.html file
4. **Use the HTTPS URL** for Missive integration

#### Option C: Netlify/Vercel (Free alternatives)
1. **Connect** your repository to Netlify or Vercel
2. **Deploy** with default settings
3. **Use the provided** HTTPS URL

### 🎯 Adding to Missive

1. Open Missive → **Settings** → **Integrations**
2. Click **Add Integration** → **Custom iframe**
3. **Set URL** to your hosted plugin location (e.g., `https://yourusername.github.io/woocommerce-missive/`)
4. **Configure** integration name: "QuikrStuff Orders"
5. **Set dimensions**: Width: 400px, Height: 600px (recommended)
6. **Save** the integration

## 💻 Usage

1. **Select a Conversation**: Choose any conversation in Missive
2. **Automatic Detection**: The plugin automatically detects the customer's email from conversation participants
3. **Browse Orders**: View the customer's complete order history in a beautiful, organized list
4. **Order Details**: Click any order card to open a detailed modal showing:
   - 📦 **Order items** with quantities and individual prices
   - 🏠 **Shipping address** and delivery information
   - 💳 **Payment method** and transaction details
   - 💰 **Order totals** including subtotal, shipping, taxes, and final total
   - 📊 **Order status** with color-coded badges

### 🎨 What You'll See

- **Order List**: Clean cards showing order number, date, status, and total
- **Status Badges**: Color-coded status indicators (pending, processing, completed, etc.)
- **Responsive Design**: Perfect layout on desktop, tablet, and mobile
- **Real-time Updates**: Automatic refresh when switching between conversations
- **Error Handling**: Helpful messages for connection issues or missing data

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

## 🔧 Troubleshooting

### ⚙️ "WooCommerce configuration required"
- ✅ Plugin should work immediately with QuikrStuff.com - try refreshing
- ❌ If using custom store: verify your API credentials are set correctly
- 🔍 Check that your WooCommerce store URL is accessible
- 🔑 Ensure API credentials have at least "Read" permissions

### 🔐 "WooCommerce authentication failed"
- 🔄 Try refreshing the page (credentials may need to reload)
- ✅ For QuikrStuff.com: Contact support if issue persists
- ❌ For custom stores: Double-check your Consumer Key and Consumer Secret
- 🔧 Verify the API key is active in WooCommerce settings
- 📡 Ensure your WooCommerce store has REST API enabled

### 📧 "No customer email found"
- 👤 Verify the conversation has messages with valid email addresses
- 💬 Check that conversation participants include customer emails
- 🔄 Try selecting a different conversation with clear sender information
- 📝 Ensure the conversation has actual message content (not just notifications)

### 📦 Orders not loading
- 🕵️ Check browser console (F12) for detailed error messages
- 🌐 For custom stores: Verify CORS is properly configured
- 👥 Ensure the customer email exists in your WooCommerce customer database
- 🔄 Try the retry button or refresh the integration
- 📞 For QuikrStuff.com issues: Contact store support

### 🚀 Integration not appearing in Missive
- 🔗 Verify the hosted URL is accessible via HTTPS
- 📱 Check that all files (index.html, app.js, styles.css) are uploaded
- 🔧 Ensure Missive iframe integration is configured correctly
- 📐 Try adjusting iframe dimensions in Missive settings

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

## 📞 Support & Resources

### 🆘 Getting Help
1. **First**: Check the troubleshooting section above
2. **Debug**: Review browser console (F12) for error messages  
3. **Test**: Verify the integration works with test conversations
4. **Contact**: Reach out for QuikrStuff.com specific issues

### 📚 Useful Resources
- [Missive iframe Integration Docs](https://learn.missiveapp.com/api-documentation/iframe-integrations)
- [WooCommerce REST API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [GitHub Pages Hosting Guide](https://pages.github.com/)

### 🔧 Development Resources
- **Missive JS API**: `https://integrations.missiveapp.com/missive.js`
- **Missive CSS**: `https://integrations.missiveapp.com/missive.css`
- **Test WooCommerce API**: Use tools like Postman or curl to test API endpoints

## 🏆 Why This Integration?

- **✅ Pre-configured**: Works immediately with QuikrStuff.com
- **🎨 Beautiful UI**: Modern design that fits Missive perfectly
- **⚡ Fast**: Optimized performance with efficient API calls
- **📱 Responsive**: Works on all devices and screen sizes
- **🔒 Secure**: Uses proper authentication and HTTPS
- **🛠️ Maintainable**: Clean, well-documented code structure