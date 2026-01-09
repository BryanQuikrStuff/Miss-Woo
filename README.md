
# Miss-Woo Integration

**Version**: vJS4.19  
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

### vJS4.19 (Current)

- **Fixed preloading API usage**: Changed from unsupported limit/sort parameters to conversation ID accumulation
- **API compliance**: Now uses correct `fetchConversations(idsArray)` format per official Missive API documentation
- **Improved preloading strategy**: Accumulates conversation IDs from `change:conversations` events and triggers bulk preload once 5+ IDs collected
- **Eliminated null responses**: Removed attempts to use unsupported limit/sort parameters that returned null

### vJS4.18

- **Bulk preloading for inbox**: Added automatic fetching and preloading of 15 most recent emails when inbox opens
- **Improved performance**: Preloads customer data for top 15 emails in background for faster access
- **Smart fetching**: Tries multiple API formats to ensure compatibility with different Missive API versions
- **Duplicate prevention**: Uses flag to prevent fetching recent conversations multiple times per session

### vJS4.17

- **API call optimization**: Added request deduplication to prevent duplicate Katana API calls
- **Performance improvement**: In-flight request tracking ensures each order is only fetched once, even with concurrent requests
- **Reduced API usage**: Eliminates redundant API calls when multiple code paths request the same order simultaneously
- **Better logging**: Added "Reusing in-flight request" messages to track when duplicate calls are prevented

### vJS4.16

- **Fixed serial number display for historical orders**: Added sales export data check to `batchGetSerialNumbers()` function
- **Improved data lookup flow**: Orders ≤ 19769 now check sales export data before attempting Katana API calls
- **Fixed missing serial numbers**: Resolved issue where serial numbers showed "N/A" for orders in JSON file
- **Performance optimization**: Batch serial number fetching now properly uses sales export data when available

### vJS4.15

- **Enhanced debugging for sales export data**: Added comprehensive logging to track data loading, lookup, and retrieval for historical orders
- **Fixed abort signal issue**: Removed abort signal from sales export data fetch during initialization to prevent loading failures
- **Improved data loading**: Added wait logic to ensure sales export data is loaded before attempting lookups
- **Better error handling**: Enhanced error messages and logging throughout the sales export data flow

### vJS4.14
- ✅ **Combined Sales Export Data**: Optimized sales_export_filtered.json structure - entries with same order number are now combined
- ✅ **Improved Data Structure**: Each order now has a single entry with combined SerialNumbers and Keys arrays
- ✅ **Better Performance**: Reduced file size and faster lookups with combined data structure

### vJS4.13
- ✅ **Historical Sales Data Integration**: Added support for sales export data for older orders (≤ 19769)
- ✅ **Serial Number Fallback**: Orders ≤ 19769 now use sales_export_filtered.json for serial numbers and keys
- ✅ **Key Number Display**: Key numbers from sales export data are now displayed alongside serial numbers
- ✅ **Improved Data Access**: Historical order data loads on initialization for fast lookup

### vJS4.12
- ✅ **Preloading Optimization**: Preload only first 15 emails when inbox opens for faster data access
- ✅ **Reduced Debounce**: Reduced preloading debounce from 500ms to 250ms for faster response
- ✅ **Performance**: Focuses preloading on most commonly accessed emails at top of inbox

### vJS4.10
- ✅ Fixed critical memory leak: Event listener removal now works properly
- ✅ Fixed undefined property error: `visibleEmails` now properly initialized
- ✅ Added missing timer cleanup: `conversationChangeDebounceTimer` now cleaned up
- ✅ Improved event listener management: Stored bound function references for proper cleanup

### vJS4.09
- ✅ JavaScript performance optimizations for faster search:
  - Early termination in filterOrdersByEmail (stops at 5 matches)
  - Reduced excessive logging in hot paths (cache hits, API responses)
  - Cached base URL construction to avoid repeated string operations
  - Streamlined cache hit path for minimal processing overhead
  - Removed unnecessary array operations and logging statements

### vJS4.08
- ✅ Fixed email normalization for consistent cache lookups
- ✅ Preloaded/cached data now properly retrieved when clicking emails
- ✅ Eliminated "Searching orders..." when data is already cached
- ✅ Improved cache hit rate with normalized email matching

### vJS4.07
- ✅ JavaScript performance optimizations for faster search:
  - Early termination in filterOrdersByEmail (stops at 5 matches)
  - Reduced excessive logging in hot paths (cache hits, API responses)
  - Cached base URL construction to avoid repeated string operations
  - Streamlined cache hit path for minimal processing overhead
  - Removed unnecessary array operations and logging statements

### vJS4.07
- ✅ Enhanced preloading to fetch ALL visible inbox conversations
- ✅ Improved fetchConversations API handling with Promise-based pattern
- ✅ Increased maxPreloadedConversations limit to 50
- ✅ Better error handling and batch processing for conversation fetching

### vJS4.06
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
