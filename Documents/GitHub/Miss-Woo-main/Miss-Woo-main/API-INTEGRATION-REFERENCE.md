# API Integration Reference - Miss-Woo

## 🔌 Complete API Documentation

This document details all external API integrations used by Miss-Woo.

---

## 1️⃣ WooCommerce REST API v3

### **Overview**
- **Base URL**: `https://quikrstuff.com/wp-json/wc/v3`
- **Authentication**: Basic Auth (Consumer Key + Secret)
- **Format**: JSON
- **Documentation**: https://woocommerce.github.io/woocommerce-rest-api-docs/

### **Authentication Method**
```javascript
// URL Parameters
const url = `${baseUrl}/orders?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
```

### **Endpoints Used**

#### **1. Search Orders by Email**
```http
GET /wp-json/wc/v3/orders?search={email}&per_page=100&page=1
```

**Parameters**:
- `search` (string): Customer email address
- `per_page` (integer): Results per page (max 100)
- `page` (integer): Page number for pagination
- `consumer_key` (string): API consumer key
- `consumer_secret` (string): API consumer secret

**Response**:
```json
[
  {
    "id": 12345,
    "number": "12345",
    "status": "completed",
    "date_created": "2025-10-21T10:00:00",
    "billing": {
      "first_name": "John",
      "last_name": "Smith",
      "email": "customer@example.com",
      "phone": "(555) 123-4567",
      "address_1": "123 Main St",
      "address_2": "",
      "city": "New York",
      "state": "NY",
      "postcode": "10001",
      "country": "US"
    },
    "line_items": [...],
    "meta_data": [...]
  }
]
```

**Used In**: `searchWooCommerceOrders(email)`

---

#### **2. Get Single Order**
```http
GET /wp-json/wc/v3/orders/{order_id}
```

**Parameters**:
- `order_id` (integer): WooCommerce order ID
- `consumer_key` (string): API consumer key
- `consumer_secret` (string): API consumer secret

**Response**:
```json
{
  "id": 12345,
  "number": "12345",
  "status": "completed",
  "date_created": "2025-10-21T10:00:00",
  "billing": {...},
  "shipping": {...},
  "line_items": [...],
  "meta_data": [...]
}
```

**Used In**: `getOrderById(orderId)`

---

#### **3. Get Order Notes**
```http
GET /wp-json/wc/v3/orders/{order_id}/notes
```

**Parameters**:
- `order_id` (integer): WooCommerce order ID
- `consumer_key` (string): API consumer key
- `consumer_secret` (string): API consumer secret

**Response**:
```json
[
  {
    "id": 123,
    "date_created": "2025-10-21T10:00:00",
    "note": "Shipped via USPS. Tracking number: 9400111111111111111",
    "customer_note": false,
    "added_by_user": true
  }
]
```

**Used In**: `getOrderById(orderId)`, `processOrdersWithDetails(orders)`

---

### **Rate Limits**
- **Not explicitly documented**: WooCommerce doesn't specify hard limits
- **Best Practice**: Use caching to minimize requests
- **Current Implementation**: 
  - Request deduplication
  - Multi-level caching (5-30 minute expiry)
  - Pagination limited to 3 pages (300 orders max)

---

## 2️⃣ Katana MRP API v1

### **Overview**
- **Base URL**: `https://api.katanamrp.com/v1`
- **Authentication**: Bearer Token
- **Format**: JSON
- **Documentation**: https://help.katanamrp.com/en/articles/5139589-katana-open-api

### **Authentication Method**
```javascript
// HTTP Headers
headers: {
  'Authorization': `Bearer ${katanaApiKey}`,
  'Accept': 'application/json'
}
```

### **Endpoints Used**

#### **1. Search Sales Orders**
```http
GET /v1/sales_orders?order_no={woo_order_number}
```

**Headers**:
```
Authorization: Bearer {api_key}
Accept: application/json
```

**Parameters**:
- `order_no` (string): WooCommerce order number (e.g., "12345")

**Response**:
```json
{
  "data": [
    {
      "id": "abc123-def456-ghi789",
      "order_no": "12345",
      "status": "shipped",
      "sales_order_rows": [
        {
          "id": "row-123",
          "product_variant_id": "prod-456",
          "quantity": 1
        }
      ]
    }
  ]
}
```

**Used In**: `getKatanaOrder(wooOrderNumber)`

---

#### **2. Get Sales Order Details**
```http
GET /v1/sales_orders/{katana_order_id}
```

**Headers**:
```
Authorization: Bearer {api_key}
Accept: application/json
```

**Parameters**:
- `katana_order_id` (string): Katana sales order ID

**Response**:
```json
{
  "id": "abc123-def456-ghi789",
  "order_no": "12345",
  "status": "shipped",
  "sales_order_rows": [
    {
      "id": "row-123",
      "product_variant_id": "prod-456",
      "quantity": 1,
      "batch_number": null
    }
  ],
  "created_at": "2025-10-21T10:00:00Z"
}
```

**Used In**: `getKatanaOrderDetails(katanaOrderId)`

---

#### **3. Get Serial Numbers**
```http
GET /v1/serial_numbers?resource_id={row_id}&resource_type=SalesOrderRow
```

**Headers**:
```
Authorization: Bearer {api_key}
Accept: application/json
```

**Parameters**:
- `resource_id` (string): Sales order row ID
- `resource_type` (string): Always "SalesOrderRow"

**Response**:
```json
{
  "data": [
    {
      "id": "serial-123",
      "serial_number": "SN-ABC123",
      "product_variant_id": "prod-456",
      "status": "sold"
    },
    {
      "id": "serial-124",
      "serial_number": "SN-ABC124",
      "product_variant_id": "prod-456",
      "status": "sold"
    }
  ]
}
```

**Used In**: `getSerialNumbersForRow(rowId)`

---

### **Rate Limits**
- **Limit**: 100 requests per minute
- **Best Practice**: Cache serial numbers for 30 minutes
- **Current Implementation**: 
  - Serial number cache (30-minute expiry)
  - Katana order cache (10-minute expiry)

---

## 3️⃣ Missive Integration SDK

### **Overview**
- **SDK URL**: `https://integrations.missiveapp.com/missive.js`
- **CSS URL**: `https://integrations.missiveapp.com/missive.css`
- **Type**: JavaScript SDK loaded in iframe
- **Documentation**: https://missiveapp.com/help/api-documentation/integrations-api

### **SDK Loading**
```html
<script src="https://integrations.missiveapp.com/missive.js"></script>
<link rel="stylesheet" href="https://integrations.missiveapp.com/missive.css">
```

### **Global Object**
```javascript
window.Missive
```

### **Methods Used**

#### **1. Get Current Conversation**
```javascript
const conversation = await Missive.getCurrentConversation();
```

**Returns**:
```javascript
{
  id: "conv-123",
  email_addresses: [
    {
      address: "customer@example.com",
      name: "John Smith"
    }
  ],
  messages: [...],
  participants: [...]
}
```

**Used In**: `fetchVisibleConversations()`, preloading system

---

#### **2. Get Current Email**
```javascript
const emailData = await Missive.getCurrentEmail();
```

**Returns**:
```javascript
{
  email: "customer@example.com",
  from: {
    email: "customer@example.com",
    name: "John Smith"
  },
  to: [...],
  subject: "Order inquiry",
  text: "Email body content..."
}
```

**Used In**: `getEmailFromMissiveAPI()`

---

#### **3. Fetch Conversations**
```javascript
const conversations = await Missive.fetchConversations({ 
  limit: 20,
  sort: 'oldest'
});
```

**Parameters**:
- `limit` (integer): Maximum conversations to fetch
- `sort` (string): Sort order ('oldest' or 'newest')

**Returns**: Array of conversation objects

**Used In**: `fetchVisibleConversations()`

---

### **Event Listeners**

#### **Event: change:conversations**
```javascript
Missive.on('change:conversations', (data) => {
  // Triggered when conversation list changes
  // data contains array of conversation IDs
});
```

**Used In**: Dynamic preloading system

---

#### **Event: email:focus**
```javascript
Missive.on('email:focus', (emailData) => {
  // Triggered when user focuses on an email
  const email = extractEmailFromData(emailData);
  performAutoSearch(email);
});
```

**Used In**: Auto-search trigger

---

## 🔐 Security Considerations

### **API Keys Storage**

**Current Implementation** (Frontend-only):
```javascript
// src/config.js - Placeholders replaced by GitHub Actions during build
const config = {
  woocommerce: {
    consumerKey: "${{ secrets.WOOCOMMERCE_CONSUMER_KEY }}",
    consumerSecret: "${{ secrets.WOOCOMMERCE_CONSUMER_SECRET }}"
  },
  katana: {
    apiKey: "${{ secrets.KATANA_API_KEY }}"
  }
};
```

⚠️ **Security Note**: API keys are injected during build from GitHub Secrets. For local development, replace placeholders with your actual keys.

### **Recommended Improvements**:

1. **Backend Proxy** (Best Practice):
```
Browser → Backend Proxy → WooCommerce/Katana
         (Auth handled     (Secure API calls)
          server-side)
```

2. **Environment Variables** (Development):
```javascript
// .env (not committed to git)
WOOCOMMERCE_CONSUMER_KEY=your_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_secret_here
WOOCOMMERCE_SITE_URL=https://your-site.com
KATANA_API_KEY=your_katana_key_here
```

3. **Key Rotation Schedule**:
- Rotate API keys quarterly
- Monitor API usage for anomalies
- Use read-only keys where possible

---

## 🧪 Testing API Calls

### **Testing WooCommerce API**

**Manual Test**:
```bash
curl "https://quikrstuff.com/wp-json/wc/v3/orders?consumer_key=YOUR_KEY&consumer_secret=YOUR_SECRET&per_page=1"
```

**Expected Response**: JSON array with 1 order

---

### **Testing Katana API**

**Manual Test**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.katanamrp.com/v1/sales_orders?order_no=12345"
```

**Expected Response**: JSON object with sales order data

---

### **Testing Missive Integration**

**Manual Test**:
1. Deploy to GitHub Pages
2. Add integration URL in Missive settings
3. Open Missive and navigate to integration
4. Check browser console for `window.Missive` object

---

## 📊 API Call Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Action in Missive               │
│              (Clicks email or focuses thread)           │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Missive SDK Event Triggered                │
│         (change:conversations, email:focus)             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           Extract Email from Event Data                 │
│        (extractEmailFromData, filter internal)          │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Check Cache for Email                      │
│    (emailCache, orderCache, preloadedConversations)     │
└───────────┬─────────────────────────────┬───────────────┘
            │                             │
     Cache Hit                      Cache Miss
            │                             │
            ▼                             ▼
┌───────────────────┐     ┌───────────────────────────────┐
│  Display Cached   │     │  API Call: WooCommerce        │
│     Results       │     │  searchWooCommerceOrders()    │
└───────────────────┘     └───────────┬───────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────────────┐
                          │  API Call: WooCommerce        │
                          │  Get Order Notes (parallel)   │
                          └───────────┬───────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────────────┐
                          │  Display Basic Order Info     │
                          │  (Date, Order #)              │
                          └───────────┬───────────────────┘
                                      │
                          ┌───────────┴───────────────────┐
                          │                               │
                          ▼                               ▼
            ┌─────────────────────────┐   ┌─────────────────────────┐
            │ API Call: Katana        │   │ Extract Tracking from   │
            │ Get Serial Numbers      │   │ Order Notes (local)     │
            └─────────┬───────────────┘   └─────────┬───────────────┘
                      │                             │
                      ▼                             ▼
            ┌─────────────────────────┐   ┌─────────────────────────┐
            │ Update Serial # Column  │   │ Update Tracking Column  │
            └─────────────────────────┘   └─────────────────────────┘
                      │                             │
                      └─────────────┬───────────────┘
                                    ▼
                        ┌───────────────────────────┐
                        │  Cache Results            │
                        │  (5-30 minute expiry)     │
                        └───────────────────────────┘
```

---

## 🔄 Error Handling

### **API Error Scenarios**

#### **1. WooCommerce API Errors**
```javascript
// HTTP 401 - Authentication failed
{
  "code": "woocommerce_rest_cannot_view",
  "message": "Sorry, you cannot list resources.",
  "data": { "status": 401 }
}
```

**Handling**: Show error message, check API credentials

---

#### **2. Katana API Errors**
```javascript
// HTTP 404 - Order not found
{
  "error": "Not found"
}
```

**Handling**: Return `null`, display "N/A" for serial numbers

---

#### **3. Network Errors**
```javascript
// CORS or timeout
TypeError: Failed to fetch
```

**Handling**: Retry with exponential backoff (not currently implemented)

---

#### **4. Missive SDK Errors**
```javascript
// SDK not loaded
ReferenceError: Missive is not defined
```

**Handling**: Fall back to web mode, disable auto-search

---

## 📝 API Call Examples

### **Complete Search Flow**

```javascript
// 1. Search for orders by email
const orders = await searchWooCommerceOrders('customer@example.com');
// GET /wp-json/wc/v3/orders?search=customer@example.com&per_page=100&page=1

// 2. Get order notes for each order (parallel)
const orderWithNotes = await Promise.all(orders.map(order => {
  const notes = await fetch(`/wp-json/wc/v3/orders/${order.id}/notes`);
  return { ...order, notes };
}));

// 3. Get Katana order for WooCommerce order
const katanaOrder = await getKatanaOrder(order.number);
// GET https://api.katanamrp.com/v1/sales_orders?order_no=12345

// 4. Get serial numbers from Katana
const serials = await getSerialNumbersForRow(rowId);
// GET https://api.katanamrp.com/v1/serial_numbers?resource_id=row-123&resource_type=SalesOrderRow

// 5. Display results
displayOrdersList();
```

---

**Document Version**: 1.0
**Last Updated**: October 21, 2025
**Maintained By**: Bryan (QuikrStuff)


