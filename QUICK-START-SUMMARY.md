# Miss-Woo - Quick Start Summary

## 🎯 What Is This?

**Miss-Woo** is a browser-based integration that automatically looks up WooCommerce orders when customer support agents view emails in Missive.

**Simple Explanation**: When you click on a customer email in Missive, this app instantly shows their order history, serial numbers, and tracking information.

---

## 📊 What You See (Outputs)

### **The App Displays**:
1. **Customer Info**: Name, address, phone
2. **Order Table**: 
   - Date of order
   - Order number (clickable → opens WooCommerce)
   - Serial number (from Katana MRP)
   - Tracking number (clickable → opens carrier site)

### **Example Output**:
```
Name: John Smith
Address: 123 Main St, New York, NY, 10001, US
Phone: (555) 123-4567

Orders:
┌────────────┬──────────┬───────────────┬──────────────────────┐
│ Date       │ Order #  │ Serial #      │ Tracking             │
├────────────┼──────────┼───────────────┼──────────────────────┤
│ 10/21/2025 │ #12345   │ SN-ABC123     │ 9400111111111111111  │
│ 10/15/2025 │ #12340   │ SN-XYZ789     │ N/A                  │
└────────────┴──────────┴───────────────┴──────────────────────┘
```

👉 **See `APPLICATION-OUTPUTS.md` for detailed output examples**

---

## 🔌 How It Works (Data Flow)

```
1. User clicks email in Missive
        ↓
2. App extracts customer email
        ↓
3. Searches WooCommerce for orders
        ↓
4. Gets serial numbers from Katana
        ↓
5. Displays results in table
```

**APIs Connected**:
- ✅ **WooCommerce** - Order data
- ✅ **Katana MRP** - Serial numbers
- ✅ **Missive** - Email event triggers

👉 **See `API-INTEGRATION-REFERENCE.md` for complete API details**

---

## 📁 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/app.js` | Main application logic | 2,294 |
| `src/config.js` | API credentials | 16 |
| `src/styles.css` | UI styling | - |
| `index-dev.html` | Development HTML | 45 |
| `index.html` | Production HTML | - |
| `README.md` | Project documentation | 170 |

---

## 🚀 Quick Setup

### **For Viewing/Testing** (No Installation):
1. Open `index-dev.html` in a browser
2. That's it! The app will load

### **For Development** (Requires Node.js):
1. Install Node.js: https://nodejs.org/
2. Open terminal in project folder
3. Run: `npm install`
4. Run: `npx http-server -p 3000 --cors`
5. Open: http://localhost:3000/index-dev.html

### **For Production Use**:
1. Already deployed at: https://bryanquikrstuff.github.io/Miss-Woo/
2. Add integration URL in Missive settings
3. Click emails to auto-search

---

## 📚 Documentation Index

We've created **4 comprehensive guides** for you:

### **1. DEVELOPMENT-GUIDE.md** 📖
**What it covers**:
- Complete setup instructions
- API documentation requirements
- Code structure walkthrough
- Development workflow
- Testing guidelines
- Deployment process

**Read this if you want to**: Make changes to the code

---

### **2. APPLICATION-OUTPUTS.md** 📊
**What it covers**:
- Detailed output examples
- Table structure
- Loading states
- Error messages
- Visual design specs

**Read this if you want to**: Understand what the app displays

---

### **3. API-INTEGRATION-REFERENCE.md** 🔌
**What it covers**:
- WooCommerce API endpoints
- Katana MRP API endpoints
- Missive SDK methods
- Authentication details
- Error handling
- API call flow diagrams

**Read this if you want to**: Work with the APIs or troubleshoot integration issues

---

### **4. QUICK-START-SUMMARY.md** ⚡ (This File)
**What it covers**:
- High-level overview
- Quick reference
- Navigation to detailed docs

**Read this if you want to**: Get oriented quickly

---

## 🎓 Learning Path

### **If You're New to the Project**:
1. ✅ Read this file (QUICK-START-SUMMARY.md)
2. ✅ Read APPLICATION-OUTPUTS.md to see what it does
3. ✅ Open `index-dev.html` in browser to see it in action
4. ✅ Read DEVELOPMENT-GUIDE.md for setup
5. ✅ Read src/app.js to understand the code

### **If You Need to Make Changes**:
1. ✅ Read DEVELOPMENT-GUIDE.md
2. ✅ Set up Node.js and install dependencies
3. ✅ Read API-INTEGRATION-REFERENCE.md
4. ✅ Make changes to src/ files
5. ✅ Test locally with `index-dev.html`
6. ✅ Commit and push to GitHub (auto-deploys)

### **If You're Troubleshooting**:
1. ✅ Check browser console for errors
2. ✅ Verify API credentials in `src/config.js`
3. ✅ Read API-INTEGRATION-REFERENCE.md for error codes
4. ✅ Check DEVELOPMENT-GUIDE.md "Common Issues" section

---

## 🔑 Most Important Things to Know

### **1. API Credentials** ⚠️
- Located in: `src/config.js`
- **SECURITY WARNING**: Keys are visible in browser
- Should be rotated regularly
- Consider backend proxy for production

### **2. How Auto-Search Works**
- Listens for Missive email events
- Extracts customer email automatically
- Filters out @quikrstuff.com emails
- Searches WooCommerce orders
- Displays latest 5 orders

### **3. Caching System**
- Orders cached for 5 minutes
- Katana data cached for 10 minutes
- Serial numbers cached for 30 minutes
- Prevents excessive API calls

### **4. Deployment**
- GitHub Pages auto-deployment
- Triggered on push to `main` branch
- Live URL: https://bryanquikrstuff.github.io/Miss-Woo/
- GitHub Actions workflow in `.github/workflows/main.yml`

---

## 🛠️ Common Tasks

### **Task: Update API Credentials**
1. Edit `src/config.js`
2. Update `consumerKey`, `consumerSecret`, or `apiKey`
3. Test locally
4. Commit and push

### **Task: Change Number of Orders Displayed**
1. Open `src/app.js`
2. Find `filterOrdersByEmail()` method (line ~490)
3. Change `.slice(0, 5)` to desired number
4. Save and test

### **Task: Add New Tracking Carrier**
1. Open `src/app.js`
2. Find `extractTrackingFromText()` method (line ~1147)
3. Add carrier pattern to `carrierPatterns` array
4. Update `getCarrierTrackingUrl()` method (line ~1197)
5. Test with sample tracking number

### **Task: Deploy Changes**
1. Make changes to `src/` files
2. Test locally with `index-dev.html`
3. Commit: `git commit -m "feat: your change description"`
4. Push: `git push origin main`
5. Wait for GitHub Actions to complete
6. Check: https://bryanquikrstuff.github.io/Miss-Woo/

---

## 🐛 Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| "Loading..." stuck | Check browser console, verify API keys |
| No orders found | Verify customer has orders in WooCommerce |
| Serial numbers show N/A | Check Katana order exists with matching number |
| Auto-search not working | Verify running in Missive, not web browser |
| CORS errors | Ensure WooCommerce CORS settings allow requests |
| API errors | Check API credentials in `config.js` |

**Full troubleshooting guide**: DEVELOPMENT-GUIDE.md → "Common Issues & Solutions"

---

## 📞 Need More Help?

### **Documentation Files** (In Order of Detail):
1. 📋 `QUICK-START-SUMMARY.md` ← You are here
2. 📖 `DEVELOPMENT-GUIDE.md` ← Complete development guide
3. 📊 `APPLICATION-OUTPUTS.md` ← Output reference
4. 🔌 `API-INTEGRATION-REFERENCE.md` ← API details
5. 📝 `README.md` ← Original project README

### **Code Files** (In Order of Importance):
1. 🎯 `src/app.js` ← Main application (heavily commented)
2. ⚙️ `src/config.js` ← API configuration
3. 🎨 `src/styles.css` ← Styling
4. 📄 `index-dev.html` ← Development HTML
5. 🧪 `__tests__/*.test.js` ← Test files

---

## 🎯 Next Steps

**Recommended Actions**:
1. ✅ Install Node.js and Git (if not already installed)
2. ✅ Run `npm install` in project directory
3. ✅ Test locally: `npx http-server -p 3000 --cors`
4. ✅ Read DEVELOPMENT-GUIDE.md thoroughly
5. ✅ Review src/app.js to understand code structure
6. ✅ Make a small test change and deploy

**Long-term Improvements**:
1. 🔐 Implement backend proxy for API security
2. 📝 Add TypeScript for type safety
3. 🧪 Expand test coverage
4. 🎨 Enhance UI/UX
5. 📊 Add analytics/monitoring

---

## 📊 Project Stats

- **Total Lines of Code**: ~2,500+ lines
- **Main File Size**: `src/app.js` (2,294 lines)
- **APIs Integrated**: 3 (WooCommerce, Katana, Missive)
- **Deployment**: Automated via GitHub Actions
- **Test Coverage**: Basic (needs expansion)
- **Version**: vJS4.00

---

## 🌟 Key Features at a Glance

✅ **Auto-search** - Automatically searches when email focused  
✅ **Smart caching** - Reduces API calls, faster response  
✅ **Serial numbers** - Fetches from Katana MRP  
✅ **Tracking** - Auto-detects and links to carriers  
✅ **Progressive display** - Shows basic info first, enhances async  
✅ **Error handling** - Graceful degradation  
✅ **Missive integration** - Native SDK usage  
✅ **GitHub deployment** - Automated CI/CD  

---

## 📝 Quick Command Reference

```bash
# Install dependencies
npm install

# Run local server
npx http-server -p 3000 --cors

# Run tests
npm test

# View in browser (local)
http://localhost:3000/index-dev.html

# View production
https://bryanquikrstuff.github.io/Miss-Woo/
```

---

**Project**: Miss-Woo  
**Version**: vJS4.00  
**Last Updated**: October 21, 2025  
**Maintainer**: Bryan (QuikrStuff)  
**Repository**: https://github.com/BryanQuikrStuff/Miss-Woo  

---

**Happy Coding! 🚀**

