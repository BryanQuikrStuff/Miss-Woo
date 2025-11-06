
# Miss-Woo Integration

**Version**: vJS4.06  
**Status**: Active Development  
**Last Updated**: January 2025

Use this as the Integration URL in Missive to validate dynamic email access before wiring into the main app.

### Production Deployment
- **GitHub Pages**: Automatically deployed from `main` branch
- **URL**: https://bryanquikrstuff.github.io/Miss-Woo/
- **Files**: Uses `index.html` (production paths)

## 📁 File Structure

```
Miss-Woo/
├── index.html          # Production HTML (no src/ paths)
├── index-dev.html      # Development HTML (uses src/ paths)
├── src/
│   ├── app.js         # Main application logic
│   ├── config.js      # API configuration
│   └── styles.css     # Application styles
└── .github/workflows/
    └── main.yml       # CI/CD pipeline
```

## 🔧 Development Workflow

### Local Development
1. Use `index-dev.html` for local development
2. Files reference `src/` directory
3. Run `npx http-server -p 3000 --cors`
4. Open `http://localhost:3000/index-dev.html`

### Production Deployment
1. `index.html` uses root-level paths (no `src/`)
2. GitHub Actions copies files from `src/` to `dist/`
3. Deployed to GitHub Pages automatically
4. Available at: https://bryanquikrstuff.github.io/Miss-Woo/

## ⚙️ Configuration

### Environment Variables (GitHub Secrets)
- `WOOCOMMERCE_CONSUMER_KEY`: WooCommerce API consumer key
- `WOOCOMMERCE_CONSUMER_SECRET`: WooCommerce API consumer secret  
- `WOOCOMMERCE_SITE_URL`: WooCommerce site URL
- `KATANA_API_KEY`: Katana MRP API key

### Local Development
Create a `.env` file in the root directory:
```env
WOOCOMMERCE_CONSUMER_KEY=your_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_secret_here
WOOCOMMERCE_SITE_URL=https://your-site.com
KATANA_API_KEY=your_katana_key_here
```

## 🎯 Features

### Missive Integration
- **Auto-search**: Automatically searches for orders when email is focused
- **Environment Detection**: Detects Missive vs. web environment
- **Event Listeners**: Responds to email focus, thread changes, and conversation changes

### WooCommerce Integration
- **Order Search**: Search by customer email or order ID
- **Order Details**: Display order information, tracking, and serial numbers
- **Katana MRP**: Fetch serial numbers from Katana MRP system

### User Interface
- **Environment-aware**: Different UI for Missive vs. web
- **Responsive Design**: Works on desktop and mobile
- **Error Handling**: Graceful error display and recovery

## 🧪 Testing

```bash
npm test
```

Runs Jest tests for:
- WooCommerce API integration
- Application setup and initialization

## 📦 Deployment

### Automatic Deployment
- **Trigger**: Push to `main` branch
- **Process**: 
  1. Run tests
  2. Build production files
  3. Deploy to GitHub Pages
- **URL**: https://bryanquikrstuff.github.io/Miss-Woo/

### Manual Deployment
```bash
# Build production files
mkdir -p dist
cp index.html dist/
cp src/app.js dist/
cp src/styles.css dist/
cp src/config.js dist/

# Deploy to any static hosting service
```

## 🔍 Troubleshooting

### Common Issues

1. **404 Errors in Missive**: 
   - Check that GitHub Actions deployment completed
   - Verify files are in the correct paths (no `src/` in production)

2. **Loading State Stuck**:
   - Check browser console for errors
   - Verify API keys are configured correctly

3. **Auto-search Not Working**:
   - Ensure Missive environment is detected
   - Check that email events are being received

### Debug Mode
Open browser console to see detailed logs:
- Environment detection
- API calls and responses
- Error messages and stack traces

## 📝 Changelog

### vJS4.06 (Current)
- ✅ Version bump to force cache refresh in Missive

### vJS4.05
- ✅ Performance optimizations for preloading system:
  - Added debouncing (500ms) to conversation change events to prevent rapid-fire API calls
  - Implemented cache size limits with LRU eviction (100 emailCache, 50 preloadedConversations)
  - Added prioritization system to preload current conversation first
  - Enhanced error recovery with automatic retry for failed preloads
  - Improved memory management to prevent unbounded cache growth

### vJS4.04
- ✅ Automatic preloading of all visible emails: Enhanced Missive integration to automatically detect and preload customer details for all visible conversations via `change:conversations` event

### vJS4.03
- ✅ Improved cache persistence: Cache now persists throughout user session until navigation away

### vJS4.02
- ✅ Enhanced preloading: Preloads all customer details (orders, notes, Katana data, serial numbers) for all visible emails

### vJS4.01
- ✅ Restored all four performance optimizations:
  - OPTIMIZATION 1: Parallelize Katana API calls (batch fetching)
  - OPTIMIZATION 2: Parallelize WooCommerce page fetching with early termination
  - OPTIMIZATION 3: Defer order notes fetching (lazy loading)
  - OPTIMIZATION 4: Add request cancellation (AbortController support)

### vJS4.00
- ✅ Updated to use correct Missive JavaScript API methods
- ✅ Changed primary method from fetchMessages to fetchConversations
- ✅ Enhanced conversation data extraction with proper API structure
- ✅ Improved error handling and fallback mechanisms

### vJS3.55
- ✅ Added Missive-specific email extraction based on official API documentation
- ✅ Implemented from_field.address and to_fields[].address handling
- ✅ Enhanced recursive email search with comprehensive debugging
- ✅ Added testEmailExtractionWithData() debug method

### vJS3.54
- ✅ Enhanced email extraction with recursive search
- ✅ Added searchForEmailsRecursively() method
- ✅ Improved email detection in nested objects and arrays
- ✅ Added extractAllEmailsFromString() method

### v2.0
- ✅ Fixed GitHub Pages deployment paths
- ✅ Improved Missive environment detection
- ✅ Added aggressive loading state clearing
- ✅ Enhanced error handling and debugging
- ✅ Added `change:conversations` event listener
- ✅ Simplified configuration management

### v1.0
- Initial release with basic WooCommerce integration
- Manual search functionality
- Basic Missive integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally using `index-dev.html`
5. Submit a pull request

## 📄 License

This project is proprietary software for QuikrStuff integration with Missive.
