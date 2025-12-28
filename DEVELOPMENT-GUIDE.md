# Miss-Woo Development Guide

## 📚 Documentation Requirements for Continued Development

### **1. API Documentation Needed**

#### **WooCommerce REST API v3**
- **Current Access**: ✅ Already configured in `config.js`
- **Documentation URL**: https://woocommerce.github.io/woocommerce-rest-api-docs/
- **Key Endpoints Used**:
  - `GET /wp-json/wc/v3/orders` - Search orders by email
  - `GET /wp-json/wc/v3/orders/{id}` - Get order details
  - `GET /wp-json/wc/v3/orders/{id}/notes` - Get order notes
  
**Needed for Development**:
- [ ] Full WooCommerce REST API v3 reference
- [ ] Order object schema documentation
- [ ] Order notes structure
- [ ] Meta data field documentation
- [ ] Rate limits and pagination rules

#### **Katana MRP API v1**
- **Current Access**: ✅ Already configured in `config.js`
- **Documentation URL**: https://help.katanamrp.com/en/articles/5139589-katana-open-api
- **Key Endpoints Used**:
  - `GET /v1/sales_orders?order_no={woo_order_number}` - Find Katana order
  - `GET /v1/sales_orders/{id}` - Get full order details
  - `GET /v1/serial_numbers?resource_id={row_id}&resource_type=SalesOrderRow` - Get serials

**Needed for Development**:
- [ ] Katana API complete endpoint reference
- [ ] Sales order object structure
- [ ] Serial number resource types
- [ ] Authentication best practices
- [ ] API rate limits

#### **Missive Integration SDK**
- **Current Access**: ✅ Loaded from `https://integrations.missiveapp.com/missive.js`
- **Documentation URL**: https://missiveapp.com/help/api-documentation/integrations-api
- **Key Features Used**:
  - Event listeners: `change:conversations`, `email:focus`
  - Methods: `getCurrentConversation()`, `getCurrentEmail()`
  
**Needed for Development**:
- [ ] Complete Missive JavaScript SDK documentation
- [ ] Event types and data structures
- [ ] Conversation object schema
- [ ] Email object schema
- [ ] Best practices for iframe integrations

---

### **2. Business Logic Documentation**

**Needed for Understanding Workflows**:
- [ ] **Order Fulfillment Process**: How does QuikrStuff process orders?
- [ ] **Serial Number Assignment**: When/how are serial numbers assigned in Katana?
- [ ] **Shipping Workflow**: How are tracking numbers added to orders?
- [ ] **Customer Support SOP**: What information do agents typically need?
- [ ] **Edge Cases**: What happens with:
  - Orders without serial numbers
  - Partial shipments
  - Returns/refunds
  - Multiple shipping addresses

---

### **3. Testing Documentation**

**Current Test Coverage**:
- ✅ Basic WooCommerce API tests (`__tests__/woocommerce.test.js`)
- ✅ App initialization tests (`__tests__/app.test.js`)

**Needed for Testing**:
- [ ] Test WooCommerce account credentials
- [ ] Sample order data for testing
- [ ] Katana test environment (if available)
- [ ] Missive test integration URL
- [ ] Test email addresses with known orders
- [ ] Expected output examples

---

### **4. Development Environment Setup**

**What You Need to Install** (if you want full development capabilities):

#### **Required for Development**:
1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Needed for: Running tests, npm packages, development server
   
2. **Git** (for version control)
   - Download: https://git-scm.com/download/win
   - Needed for: Pushing changes to GitHub

#### **Optional but Recommended**:
3. **Visual Studio Code** (code editor)
   - Download: https://code.visualstudio.com/
   
4. **Browser Developer Tools**
   - Chrome DevTools or Firefox Developer Tools
   - For debugging and testing

---

### **5. Deployment Documentation**

**Current Deployment**:
- ✅ Automated via GitHub Actions (`.github/workflows/main.yml`)
- ✅ Deploys to: https://bryanquikrstuff.github.io/Miss-Woo/
- ✅ Triggered on push to `main` branch

**Needed for Deployment**:
- [ ] GitHub repository access
- [ ] GitHub Pages configuration documentation
- [ ] GitHub Actions secrets management
- [ ] Rollback procedures
- [ ] Monitoring/logging setup

---

### **6. Missive Integration Setup**

**To Use in Missive**:
1. Open Missive → Settings → Integrations
2. Add Custom Integration
3. Set Integration URL to: `https://bryanquikrstuff.github.io/Miss-Woo/`
4. Configure permissions (if needed)

**Needed Documentation**:
- [ ] Missive organization admin access
- [ ] Integration configuration guide
- [ ] Permissions required
- [ ] Troubleshooting guide

---

## 🔧 Development Setup Instructions

### **Quick Start (No Node.js)**

1. **Open the project folder**:
   ```
   C:\Users\tkoch\OneDrive\GitHub For Cursor (QRS)\Miss-Woo-main
   ```

2. **Edit files directly**:
   - `src/app.js` - Main application logic
   - `src/config.js` - API configuration
   - `src/styles.css` - Styling
   - `index-dev.html` - Development HTML

3. **Test locally**:
   - Double-click `index-dev.html` to open in browser
   - Or use any local web server

### **Full Setup (With Node.js)**

1. **Install Node.js**:
   - Download from: https://nodejs.org/
   - Run installer
   - Restart terminal

2. **Install dependencies**:
   ```bash
   cd "C:\Users\tkoch\OneDrive\GitHub For Cursor (QRS)\Miss-Woo-main"
   npm install
   ```

3. **Run development server**:
   ```bash
   npx http-server -p 3000 --cors
   ```
   - Open: http://localhost:3000/index-dev.html

4. **Run tests**:
   ```bash
   npm test
   ```

---

## 📖 Code Structure Guide

### **Main Application Class: `MissWooApp`**

#### **Key Methods**:

**Initialization**:
- `constructor(config)` - Initialize app with API credentials
- `initialize()` - Setup event listeners and UI
- `detectMissiveEnvironment()` - Detect if running in Missive

**Search Functions**:
- `handleSearch()` - Manual search handler
- `performAutoSearch(email)` - Auto-search when email detected
- `searchOrdersByEmail(email)` - Search WooCommerce orders
- `searchWooCommerceOrders(email)` - Paginated order search

**Data Retrieval**:
- `getOrderById(orderId)` - Fetch single order
- `getKatanaOrder(wooOrderNumber)` - Get matching Katana order
- `getSerialNumber(order)` - Extract serial numbers
- `getTrackingInfo(order)` - Extract tracking information

**Display Functions**:
- `displayOrdersList()` - Render order table
- `createCustomerInfoSection()` - Create customer info display
- `setStatus(message, type)` - Update status message

**Email Extraction**:
- `extractEmailFromData(data)` - Extract email from various data structures
- `extractEmailFromParticipants(participants)` - Parse participant data
- `extractEmailFromString(text)` - Regex-based email extraction
- `isValidEmailForSearch(email)` - Validate and filter emails

**Cache Management**:
- `isCacheValid(key, cacheType)` - Check cache expiration
- `setCacheExpiry(key, cacheType)` - Set cache expiration time
- `clearCaches()` - Clear all caches

---

## 🐛 Common Issues & Solutions

### **Issue 1: Loading State Stuck**
**Cause**: API calls failing or environment detection issues
**Solution**: Check browser console for errors, verify API credentials

### **Issue 2: Auto-search Not Working in Missive**
**Cause**: Missive environment not detected or event listeners not set up
**Solution**: Check `detectMissiveEnvironment()` output in console

### **Issue 3: No Serial Numbers Displayed**
**Cause**: Katana order not found or serial numbers not assigned
**Solution**: Verify Katana order exists with matching WooCommerce order number

### **Issue 4: CORS Errors**
**Cause**: Browser security blocking API calls
**Solution**: Ensure WooCommerce CORS settings allow requests from Missive/GitHub Pages

---

## 📝 Code Conventions (From User Rules)

### **Naming Conventions**:
- Variables: `camelCase` (e.g., `userName`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- Functions: `camelCase` (e.g., `getUserData()`)
- Components: `PascalCase` (e.g., `MissWooApp`)
- File names: `kebab-case.js` (e.g., `user-profile.js`)

### **Coding Standards**:
- ✅ Readable over clever
- ✅ Fail loudly (throw errors when assumptions violated)
- ✅ Use JSDoc comments for public functions
- ✅ Prefer `const` over `let`
- ✅ No `console.log` in production (currently many exist - needs cleanup)
- ✅ Meaningful commit messages using conventional commits

---

## 🚀 Next Steps for Development

### **Immediate Actions**:
1. [ ] Install Node.js and Git
2. [ ] Run `npm install` to get dependencies
3. [ ] Test the application locally
4. [ ] Review and understand the main `app.js` file

### **Short-term Improvements**:
1. [ ] Add TypeScript for better type safety
2. [ ] Remove excessive `console.log` statements
3. [ ] Add comprehensive error handling
4. [ ] Write additional unit tests
5. [ ] Add integration tests for API calls

### **Long-term Enhancements**:
1. [ ] Add user preferences/settings
2. [ ] Implement order filtering/sorting
3. [ ] Add export functionality (CSV, PDF)
4. [ ] Create analytics dashboard
5. [ ] Add multi-language support

---

## 📞 Support & Resources

### **Useful Links**:
- **Project Repository**: https://github.com/BryanQuikrStuff/Miss-Woo
- **Live Application**: https://bryanquikrstuff.github.io/Miss-Woo/
- **WooCommerce API Docs**: https://woocommerce.github.io/woocommerce-rest-api-docs/
- **Katana API Docs**: https://help.katanamrp.com/en/articles/5139589-katana-open-api
- **Missive Integration Docs**: https://missiveapp.com/help/api-documentation/integrations-api

### **Key Files to Reference**:
- **README.md** - Project overview and deployment info
- **package.json** - Dependencies and scripts
- **src/app.js** - Main application logic (2,294 lines - heavily commented)
- **src/config.js** - API credentials ⚠️ (Keep secure!)

---

## ⚠️ Security Notes

**API Credentials in `config.js`**:
- ⚠️ **NEVER commit real API keys to public repositories**
- Current setup has keys in plain text (frontend-only limitation)
- Consider implementing a backend proxy for production
- Rotate keys regularly
- Use environment variables for local development

---

**Last Updated**: October 21, 2025
**Version**: vJS4.12
**Maintainer**: Bryan (QuikrStuff)

