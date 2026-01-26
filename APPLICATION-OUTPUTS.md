# Miss-Woo Application Outputs Reference

## 📊 What the Application Displays

### **Primary User Interface**

The application displays customer order information in a clean, tabular format within the Missive email client interface.

---

## 🎯 Output Sections

### **1. Customer Information Header**

**Displayed Fields**:
```
Name: [First Name] [Last Name]
Address: [Street], [City], [State], [Zip], [Country]
Phone: [Phone Number]
```

**Data Source**: WooCommerce order billing information

**Visual Indicator**: 
- ✅ Green text if all orders have matching customer info
- ⚠️ Yellow/highlighted if customer info varies between orders

---

### **2. Order Table**

**Table Structure**:
```
┌────────────┬──────────┬───────────────┬──────────────────────┐
│ Date       │ Order #  │ Serial #      │ Tracking             │
├────────────┼──────────┼───────────────┼──────────────────────┤
│ 10/15/2025 │ #12345   │ SN-123456789  │ 9400123456789012345  │
│ 10/10/2025 │ #12344   │ SN-987654321  │ 9400987654321098765  │
│ 10/05/2025 │ #12343   │ N/A           │ N/A                  │
└────────────┴──────────┴───────────────┴──────────────────────┘
```

**Column Details**:

#### **Column 1: Date**
- **Format**: `MM/DD/YYYY` (localized)
- **Source**: `order.date_created` from WooCommerce
- **Example**: `10/21/2025`

#### **Column 2: Order #**
- **Format**: Clickable hyperlink `#[order_number]`
- **Link Target**: WooCommerce admin order edit page
- **URL Pattern**: `https://quikrstuff.com/wp-admin/post.php?post=[order_id]&action=edit`
- **Example**: `#12345` → Opens order in WooCommerce admin

#### **Column 3: Serial #**
- **Format**: Comma-separated list if multiple serials
- **Source**: Katana MRP API (`serial_numbers` endpoint)
- **Examples**: 
  - `SN-123456789` (single serial)
  - `SN-123, SN-456, SN-789` (multiple serials)
  - `N/A` (no serial number found)
- **Loading State**: Shows "Loading..." initially, then updates asynchronously

#### **Column 4: Tracking**
- **Format**: Clickable hyperlink with tracking number
- **Link Target**: Carrier tracking website (USPS, FedEx, UPS, DHL)
- **Source**: Extracted from WooCommerce order notes and metadata
- **Examples**:
  - `9400123456789012345` → USPS tracking
  - `1Z999AA10123456784` → UPS tracking
  - `N/A` (no tracking information)
- **Loading State**: Shows "Loading..." initially, then updates asynchronously

---

## 📋 Output Examples

### **Example 1: Complete Order with All Information**

```
Customer Information:
Name: John Smith
Address: 123 Main St, New York, NY, 10001, US
Phone: (555) 123-4567

Orders:
┌────────────┬──────────┬──────────────┬─────────────────────┐
│ Date       │ Order #  │ Serial #     │ Tracking            │
├────────────┼──────────┼──────────────┼─────────────────────┤
│ 10/21/2025 │ #12345   │ SN-ABC123    │ 9400111111111111111 │
└────────────┴──────────┴──────────────┴─────────────────────┘
```

### **Example 2: Multiple Orders**

```
Customer Information:
Name: Jane Doe
Address: 456 Oak Ave, Los Angeles, CA, 90001, US
Phone: (555) 987-6543

Orders:
┌────────────┬──────────┬──────────────────┬─────────────────────┐
│ Date       │ Order #  │ Serial #         │ Tracking            │
├────────────┼──────────┼──────────────────┼─────────────────────┤
│ 10/20/2025 │ #12350   │ SN-XYZ789        │ 1Z999AA10123456784  │
│ 10/15/2025 │ #12340   │ SN-ABC456        │ 9400222222222222222 │
│ 10/10/2025 │ #12330   │ SN-DEF123        │ N/A                 │
│ 10/05/2025 │ #12320   │ N/A              │ N/A                 │
│ 10/01/2025 │ #12310   │ SN-GHI999        │ 9400333333333333333 │
└────────────┴──────────┴──────────────────┴─────────────────────┘
```

### **Example 3: No Orders Found**

```
Status: No orders found
```

---

## 🔄 Loading States

The application uses progressive rendering for better user experience:

### **Initial Load**:
```
Status: Loading...
[Empty results area]
```

### **Partial Load** (Basic info displayed first):
```
Customer Information:
Name: John Smith
Address: 123 Main St, New York, NY, 10001, US
Phone: (555) 123-4567

Orders:
┌────────────┬──────────┬─────────────┬─────────────┐
│ Date       │ Order #  │ Serial #    │ Tracking    │
├────────────┼──────────┼─────────────┼─────────────┤
│ 10/21/2025 │ #12345   │ Loading...  │ Loading...  │
└────────────┴──────────┴─────────────┴─────────────┘
```

### **Complete Load**:
```
Customer Information:
Name: John Smith
Address: 123 Main St, New York, NY, 10001, US
Phone: (555) 123-4567

Orders:
┌────────────┬──────────┬─────────────┬─────────────────────┐
│ Date       │ Order #  │ Serial #    │ Tracking            │
├────────────┼──────────┼─────────────┼─────────────────────┤
│ 10/21/2025 │ #12345   │ SN-ABC123   │ 9400111111111111111 │
└────────────┴──────────┴─────────────┴─────────────────────┘

Status: Found 1 order(s)
```

---

## ⚠️ Error States

### **No Orders Found**:
```
Status: No orders found
```

### **Search Failed**:
```
Error: Failed to search: [error message]
Status: Search failed
```

### **API Connection Error**:
```
Error: Failed to connect to WooCommerce: [error message]
```

### **Invalid Email**:
```
Status: Invalid email in URL: [email]
```

---

## 📱 Status Messages

The application displays contextual status messages at the top of the interface:

### **Status Message Examples**:

| Status | Meaning |
|--------|---------|
| `Ready` | Application initialized and ready |
| `Loading...` | Fetching data from APIs |
| `Searching orders...` | Actively searching for orders |
| `Found email: user@example.com` | Email detected from Missive |
| `Found 5 order(s)` | Successfully retrieved orders |
| `No orders found` | No matching orders in WooCommerce |
| `Switching emails...` | Changing between different customer emails |
| `Search failed` | Error occurred during search |
| `Preloading visible emails...` | Background preloading active |

---

## 🎨 Visual Design

### **Colors & Styling**:
- **Links**: Blue, underlined on hover
- **Headers**: Bold, larger font
- **Tables**: Bordered rows, alternating background colors
- **Status Messages**: Different colors based on type (info, error, success)
- **Loading Indicators**: Gray text, italicized

### **Responsive Behavior**:
- Table adapts to available width
- Text wraps for long addresses
- Scrollable if many orders

---

## 🔗 Clickable Elements

### **Order Number Links**:
- **Click Action**: Opens WooCommerce admin in new tab
- **Target**: Order edit page
- **Security**: Opens in secure admin area (requires WP login)

### **Tracking Number Links**:
- **Click Action**: Opens carrier tracking page in new tab
- **Supported Carriers**:
  - USPS → `https://tools.usps.com/go/TrackConfirmAction?tLabels=[number]`
  - UPS → `https://www.ups.com/track?tracknum=[number]`
  - FedEx → `https://www.fedex.com/fedextrack/?trknbr=[number]`
  - DHL → `https://www.dhl.com/en/express/tracking.html?AWB=[number]`

---

## 📊 Data Limits

### **Orders Displayed**:
- **Maximum**: Latest 5 orders per customer
- **Sorting**: Most recent first (by `date_created`)
- **Pagination**: Not currently implemented (shows top 5 only)

### **Search Scope**:
- **WooCommerce Pages**: Searches up to 3 pages (300 orders max)
- **Results Per Page**: 100 orders
- **Email Matching**: Exact match on `billing.email` field

---

## 🧪 Test Output Examples

For testing purposes, here are some sample outputs:

### **Test Case 1: Customer with Recent Order**
```
Input: customer@example.com

Output:
Name: Test Customer
Address: 123 Test St, Test City, TS, 12345, US
Phone: (555) 000-0000

Orders:
Date       | Order # | Serial #   | Tracking
10/21/2025 | #12345  | SN-TEST123 | 9400111111111111111
```

### **Test Case 2: Customer with No Tracking**
```
Input: notracking@example.com

Output:
Name: No Tracking Customer
Address: 456 Test Ave, Test Town, TT, 54321, US
Phone: (555) 000-1111

Orders:
Date       | Order # | Serial #  | Tracking
10/20/2025 | #12340  | SN-XYZ789 | N/A
```

### **Test Case 3: Invalid Email**
```
Input: not-an-email

Output:
Status: Invalid email in URL: not-an-email
```

---

**Document Version**: 1.0
**Last Updated**: October 21, 2025
**Application Version**: vJS5.03

