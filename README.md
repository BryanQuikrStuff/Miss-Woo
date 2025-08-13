# Miss-Woo - WooCommerce Integration for Missive

A frontend application that integrates WooCommerce order data with Missive email client, providing auto-search functionality for customer emails.

## 🚀 Quick Start

### Local Development
```bash
# Use the development HTML file for local development
npx http-server -p 3000 --cors
# Then open: http://localhost:3000/index-dev.html
```

### Missive Email Events POC

We provide a lightweight proof-of-concept under `poc/` to validate Missive iframe events and email extraction.

- URL when deployed to GitHub Pages: `/Miss-Woo/poc/`
- Listens to `ready`, `change:conversations`, `email:focus`, etc.
- Displays captured emails and exposes `window.MissivePOC.getEmails()`.

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

### v2.0 (Current)
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