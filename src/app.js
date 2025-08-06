// Miss-Woo Frontend Application
import config from './config.js';

class MissWooApp {
  constructor() {
    // WooCommerce REST API v3 endpoint
    this.apiBaseUrl = config.woocommerce.apiBaseUrl;
    this.consumerKey = config.woocommerce.consumerKey;
    this.consumerSecret = config.woocommerce.consumerSecret;
    this.siteUrl = config.woocommerce.siteUrl;
    
    // Katana MRP API endpoint
    this.katanaApiBaseUrl = config.katana.apiBaseUrl;
    this.katanaApiKey = config.katana.apiKey;
    
    // Store all matched orders
    this.allOrders = [];
    this.currentPage = 1;
    this.ordersPerPage = 5;
    
    // Initialize after constructor
    this.initialize();
  }

  async initialize() {
    console.log("Initializing application...");
    console.log("Version 2.0 - Customer Info Update loaded");
    try {
      await this.bindEvents();
      await this.initializeMissive();
      // Only test connection if not in Missive environment
      if (!window.Missive) {
        await this.testConnection();
      }
      console.log("Application initialized successfully");
    } catch (error) {
      console.error("Initialization failed:", error);
      this.showError("Failed to initialize application: " + error.message);
    }
  }

  async bindEvents() {
    console.log("Binding events...");
    try {
      // Search functionality
      const searchBtn = document.getElementById("searchBtn");
      const searchInput = document.getElementById("orderSearch");

      if (!searchBtn || !searchInput) {
        throw new Error("Required DOM elements not found");
      }

      searchBtn.addEventListener("click", () => this.handleSearch());
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.handleSearch();
      });

      console.log("Events bound successfully");
    } catch (error) {
      console.error("Error binding events:", error);
      throw error;
    }
  }

  async handleSearch() {
    const searchInput = document.getElementById("orderSearch");
    const searchTerm = searchInput?.value.trim();

    if (!searchTerm) {
      this.showError("Please enter a customer email or order ID");
      return;
    }

    this.showLoading();
    console.log("Searching for:", searchTerm);

    try {
      // Reset pagination
      this.currentPage = 1;
      this.allOrders = [];

      // Check if it's an order ID (numeric)
      if (/^\d+$/.test(searchTerm)) {
        await this.getOrderById(searchTerm);
      } else {
        await this.searchOrdersByEmail(searchTerm);
      }
    } catch (error) {
      console.error("Search error:", error);
      this.showError(`Search failed: ${error.message}`);
    }
  }

  async getOrderById(orderId) {
    console.log("Fetching order by ID:", orderId);
    try {
      const url = this.getAuthenticatedUrl(`/orders/${orderId}`);
      const order = await this.makeRequest(url);
      
      if (!order || !order.id) {
        this.showError(`Order ${orderId} not found`);
        return;
      }

      // Get order notes
      const notesUrl = this.getAuthenticatedUrl(`/orders/${orderId}/notes`);
      const notes = await this.makeRequest(notesUrl);
      order.notes = notes;

      this.allOrders = [order];
      await this.displayOrdersList();
    } catch (error) {
      console.error("Get order error:", error);
      this.showError(`Failed to fetch order ${orderId}: ${error.message}`);
    }
  }

  async searchOrdersByEmail(email) {
    console.log("Searching orders for email:", email);
    try {
      // Get all orders across multiple pages
      let allFetchedOrders = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore && page <= 5) { // Limit to 5 pages to avoid too many requests
        const billingUrl = this.getAuthenticatedUrl("/orders", {
          search: email,
          per_page: perPage,
          page: page
        });
        console.log(`Searching page ${page} with URL:`, billingUrl);
        
        const pageOrders = await this.makeRequest(billingUrl);
        if (!pageOrders || pageOrders.length === 0) {
          hasMore = false;
        } else {
          allFetchedOrders = allFetchedOrders.concat(pageOrders);
          page++;
        }
      }

      console.log('Total orders found:', allFetchedOrders.length);
      
      if (allFetchedOrders.length === 0) {
        this.showError(`No orders found for email: ${email}`);
        return;
      }

      // Filter orders to match the email exactly and sort by date
      this.allOrders = allFetchedOrders
        .filter(order => {
          const orderEmail = order.billing?.email?.toLowerCase();
          const searchEmail = email.toLowerCase();
          const matches = orderEmail === searchEmail;
          console.log(`Checking order ${order.id}: ${orderEmail} against ${searchEmail}: ${matches}`);
          return matches;
        })
        .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
        .slice(0, 5); // Only keep the latest 5 orders

      // Get notes for each order
      for (const order of this.allOrders) {
        try {
          const notesUrl = this.getAuthenticatedUrl(`/orders/${order.id}/notes`);
          const notes = await this.makeRequest(notesUrl);
          order.notes = notes;
        } catch (error) {
          console.error(`Failed to fetch notes for order ${order.id}:`, error);
        }
      }

      console.log("Total matching orders (latest 5):", this.allOrders.length);
      await this.displayOrdersList();
    } catch (error) {
      console.error("Search by email error:", error);
      this.showError(`Failed to search orders for ${email}: ${error.message}`);
    }
  }

  // Helper method to create authenticated request URL
  getAuthenticatedUrl(endpoint, params = {}) {
    try {
      const url = new URL(`${this.apiBaseUrl}${endpoint}`);
      url.searchParams.append("consumer_key", this.consumerKey);
      url.searchParams.append("consumer_secret", this.consumerSecret);

      // Add any additional parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log("Generated URL:", url.toString());
      return url.toString();
    } catch (error) {
      console.error("URL creation error:", error);
      throw new Error("Failed to create API URL: " + error.message);
    }
  }

  // Helper method for making API requests
  async makeRequest(url, options = {}) {
    console.log("Making request to:", url);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers,
        },
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("API Response:", data);
      return data;
    } catch (error) {
      console.error("API Request failed:", error);
      throw error;
    }
  }

  async displayOrdersList() {
    const resultsDiv = document.getElementById("results");
    if (!resultsDiv) {
      console.error("Results container not found");
      return;
    }

    if (!this.allOrders || this.allOrders.length === 0) {
      resultsDiv.innerHTML = '<div class="no-results">No orders found</div>';
      this.hideLoading();
      return;
    }

    // Create customer info section
    const customerInfo = this.createCustomerInfoSection();
    
    // Create table without Name column
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Order #</th>
          <th>Serial #</th>
          <th>Tracking</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    for (const order of this.allOrders) {
      const tracking = this.getTrackingInfo(order);
      const row = document.createElement('tr');
      const date = new Date(order.date_created).toLocaleDateString();
      const orderLink = `${this.siteUrl}/wp-admin/post.php?post=${order.id}&action=edit`;
      
      // Create a cell for the serial number that we'll update asynchronously
      row.innerHTML = `
        <td>${date}</td>
        <td><a href="${orderLink}" target="_blank">#${order.number}</a></td>
        <td class="serial-number-cell">Loading...</td>
        <td>${tracking ? `<a href="${tracking.url}" target="_blank">${tracking.number}</a>` : 'No tracking'}</td>
      `;
      
      // Update the serial number asynchronously
      const serialNumberCell = row.querySelector('.serial-number-cell');
      this.getSerialNumber(order).then(serialNumber => {
        serialNumberCell.textContent = serialNumber || 'No serial #';
      }).catch(error => {
        console.error('Error fetching serial number:', error);
        serialNumberCell.textContent = 'Error';
      });
      
      tbody.appendChild(row);
    }

    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(customerInfo);
    resultsDiv.appendChild(table);
    this.hideLoading();
  }

  createCustomerInfoSection() {
    if (this.allOrders.length === 0) return document.createElement('div');
    
    const customerInfoDiv = document.createElement('div');
    customerInfoDiv.className = 'customer-info';
    
    // Get the first order as reference
    const firstOrder = this.allOrders[0];
    const referenceName = `${firstOrder.billing?.first_name || ''} ${firstOrder.billing?.last_name || ''}`.trim();
    const referenceAddress = this.formatAddress(firstOrder.billing);
    const referencePhone = firstOrder.billing?.phone || '';
    
    // Check if all orders have matching customer info
    const allMatch = this.allOrders.every(order => {
      const orderName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim();
      const orderAddress = this.formatAddress(order.billing);
      const orderPhone = order.billing?.phone || '';
      
      return orderName === referenceName && 
             orderAddress === referenceAddress && 
             orderPhone === referencePhone;
    });
    
    // Create customer info display
    const nameSpan = document.createElement('span');
    nameSpan.className = allMatch ? 'customer-field' : 'customer-field mismatch';
    nameSpan.textContent = `Name: ${referenceName}`;
    
    const addressSpan = document.createElement('span');
    addressSpan.className = allMatch ? 'customer-field' : 'customer-field mismatch';
    addressSpan.textContent = `Address: ${referenceAddress}`;
    
    const phoneSpan = document.createElement('span');
    phoneSpan.className = allMatch ? 'customer-field' : 'customer-field mismatch';
    phoneSpan.textContent = `Phone: ${referencePhone}`;
    
    customerInfoDiv.appendChild(nameSpan);
    customerInfoDiv.appendChild(document.createElement('br'));
    customerInfoDiv.appendChild(addressSpan);
    customerInfoDiv.appendChild(document.createElement('br'));
    customerInfoDiv.appendChild(phoneSpan);
    
    return customerInfoDiv;
  }

  formatAddress(billing) {
    if (!billing) return '';
    
    const parts = [
      billing.address_1,
      billing.address_2,
      billing.city,
      billing.state,
      billing.postcode,
      billing.country
    ].filter(part => part && part.trim());
    
    return parts.join(', ');
  }

  async getSerialNumber(order) {
    try {
      console.log(`🚀 VERSION 4.0 - SERIAL NUMBER DEBUGGING 🚀`);
      console.log(`Getting serial number for WooCommerce order #${order.number}`);
      
      // Get the Katana sales order that matches this WooCommerce order
      const katanaOrder = await this.getKatanaOrder(order.number);
      if (!katanaOrder) {
        console.log(`No Katana order found for WooCommerce order #${order.number}`);
        return null;
      }

      console.log(`Found Katana order ID: ${katanaOrder.id} for WooCommerce order #${order.number}`);

      // Try to get serial numbers from the sales order details itself
      const serialNumber = await this.getSerialNumberFromOrder(katanaOrder);
      if (serialNumber) {
        console.log(`✅ Found serial number in order details for #${order.number}: ${serialNumber}`);
        return serialNumber;
      }

      // If not found in order details, return null instead of using the problematic serial numbers endpoint
      console.log(`❌ No serial number found for order #${order.number}, returning null`);
      return null;
    } catch (error) {
      console.error('Error getting serial number:', error);
      return null;
    }
  }

  async getKatanaOrder(wooOrderNumber) {
    try {
      console.log(`=== VERSION 3.0 - Enhanced Serial Number Lookup ===`);
      console.log(`Getting Katana order for WooCommerce order #${wooOrderNumber}`);
      
      const url = `${this.katanaApiBaseUrl}/sales_orders?order_no=${wooOrderNumber}`;
      console.log(`Fetching Katana order for WooCommerce order #${wooOrderNumber}:`, url);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        }
      });
      console.log(`Katana API response status for order #${wooOrderNumber}:`, response.status);

      if (!response.ok) {
        throw new Error(`Katana API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Katana order data for order #${wooOrderNumber}:`, data);
      
      const katanaOrder = data.data?.[0] || null;
      if (katanaOrder) {
        console.log(`Found Katana order ID ${katanaOrder.id} for WooCommerce order #${wooOrderNumber}`);
        
        // Try to get the full sales order with line items
        console.log(`Attempting to get full order details for ID ${katanaOrder.id}...`);
        const fullOrder = await this.getKatanaOrderDetails(katanaOrder.id);
        if (fullOrder) {
          console.log(`Got full Katana order details for #${wooOrderNumber}:`, fullOrder);
          return fullOrder;
        } else {
          console.log(`Could not get full order details, returning basic order`);
        }
      } else {
        console.log(`No Katana order found for WooCommerce order #${wooOrderNumber}`);
      }
      
      return katanaOrder;
    } catch (error) {
      console.error(`Error fetching Katana order for #${wooOrderNumber}:`, error);
      return null;
    }
  }

  async getKatanaOrderDetails(katanaOrderId) {
    try {
      const url = `${this.katanaApiBaseUrl}/sales_orders/${katanaOrderId}`;
      console.log(`Fetching full Katana order details for ID ${katanaOrderId}:`, url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`Could not get full order details for ${katanaOrderId}, status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`Full Katana order details for ID ${katanaOrderId}:`, data);
      return data.data || data;
    } catch (error) {
      console.error(`Error fetching full Katana order details for ${katanaOrderId}:`, error);
      return null;
    }
  }

  async getSerialNumberFromOrder(katanaOrder) {
    try {
      console.log(`Looking for serial numbers in Katana order details:`, katanaOrder);
      
      // Log the complete order structure to understand the data
      console.log(`Full Katana order structure for debugging:`, JSON.stringify(katanaOrder, null, 2));
      
      // Check if the order has sales_order_rows with serial numbers
      if (katanaOrder.sales_order_rows && Array.isArray(katanaOrder.sales_order_rows)) {
        console.log(`Found sales_order_rows array with ${katanaOrder.sales_order_rows.length} items`);
        for (const row of katanaOrder.sales_order_rows) {
          console.log(`Examining sales order row:`, row);
          if (row.serial_numbers && Array.isArray(row.serial_numbers) && row.serial_numbers.length > 0) {
            console.log(`✅ Found serial numbers in sales order row:`, row.serial_numbers);
            const numericSerial = row.serial_numbers[0];
            
            // Get the formatted serial number
            const formattedSerial = await this.getFormattedSerialNumber(numericSerial);
            if (formattedSerial) {
              // Extract just the 4-digit combination
              const combination = this.extractCombination(formattedSerial);
              if (combination) {
                console.log(`✅ Extracted combination ${combination} for order`);
                return combination;
              }
            }
            
            // Fallback to numeric serial if formatted lookup fails
            console.log(`Using numeric serial as fallback: ${numericSerial}`);
            return numericSerial.toString();
          }
        }
      } else {
        console.log(`No sales_order_rows found in order`);
      }
      
      // Check if the order has a serial_numbers field directly
      if (katanaOrder.serial_numbers && Array.isArray(katanaOrder.serial_numbers) && katanaOrder.serial_numbers.length > 0) {
        console.log(`Found serial numbers in order:`, katanaOrder.serial_numbers);
        return katanaOrder.serial_numbers[0];
      }
      
      // Check if there are any serial number fields in the order
      const serialNumberFields = ['serial_number', 'serial_numbers', 'serial', 'serial_no'];
      for (const field of serialNumberFields) {
        if (katanaOrder[field]) {
          console.log(`Found serial number in field ${field}:`, katanaOrder[field]);
          return katanaOrder[field];
        }
      }
      
      // Check all fields for any serial number patterns
      console.log(`Checking all order fields for serial number patterns...`);
      for (const [key, value] of Object.entries(katanaOrder)) {
        if (typeof value === 'string' && value.match(/^\d+-\d+-\d+$/)) {
          console.log(`Found potential serial number in field ${key}: ${value}`);
          return value;
        }
      }
      
      console.log(`No serial numbers found in order details`);
      return null;
    } catch (error) {
      console.error('Error extracting serial number from order:', error);
      return null;
    }
  }

  convertSerialNumber(numericSerial) {
    // For now, return the numeric serial as-is since we don't know the conversion formula
    // You may need to provide the conversion logic from numeric to formatted serial
    console.log(`Converting numeric serial ${numericSerial} to formatted serial`);
    return numericSerial.toString();
  }

  async getFormattedSerialNumber(numericSerial) {
    try {
      // Try to get the formatted serial number from the Katana API
      const url = `${this.katanaApiBaseUrl}/serial_numbers?serial_number=${numericSerial}`;
      console.log(`Fetching formatted serial number for ${numericSerial}:`, url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`Could not get formatted serial for ${numericSerial}, status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`Formatted serial data for ${numericSerial}:`, data);
      
      if (data.data && data.data.length > 0) {
        const formattedSerial = data.data[0].serial_number;
        console.log(`Found formatted serial: ${formattedSerial}`);
        return formattedSerial;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching formatted serial for ${numericSerial}:`, error);
      return null;
    }
  }

  extractCombination(formattedSerial) {
    // Extract the 4-digit combination from formatted serial like "2-0211-08259"
    const match = formattedSerial.match(/^\d+-(\d{4})-\d+$/);
    if (match) {
      const combination = match[1];
      console.log(`Extracted combination ${combination} from serial ${formattedSerial}`);
      return combination;
    }
    console.log(`Could not extract combination from serial ${formattedSerial}`);
    return null;
  }

  async getSerialNumbersFromLineItems(katanaOrderId) {
    try {
      const url = `${this.katanaApiBaseUrl}/sales_orders/${katanaOrderId}/line_items`;
      console.log(`Fetching line items for Katana order ID ${katanaOrderId}:`, url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        }
      });

      console.log(`Line items API response status for Katana order ${katanaOrderId}:`, response.status);

      if (!response.ok) {
        console.log(`Could not get line items for ${katanaOrderId}, status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`Line items data for Katana order ${katanaOrderId}:`, data);
      
      // Look for serial numbers in line items
      const lineItems = data.data || data;
      if (Array.isArray(lineItems)) {
        for (const lineItem of lineItems) {
          if (lineItem.serial_numbers && Array.isArray(lineItem.serial_numbers) && lineItem.serial_numbers.length > 0) {
            console.log(`Found serial numbers in line item:`, lineItem.serial_numbers);
            return lineItem.serial_numbers[0];
          }
        }
      }
      
      console.log(`No serial numbers found in line items`);
      return null;
    } catch (error) {
      console.error(`Error fetching line items for order ${katanaOrderId}:`, error);
      return null;
    }
  }

  async getKatanaSerialNumbers(katanaOrderId) {
    try {
      const url = `${this.katanaApiBaseUrl}/serial_numbers?sales_order_id=${katanaOrderId}`;
      console.log(`Fetching serial numbers for Katana order ID ${katanaOrderId}:`, url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        }
      });

      console.log(`Serial numbers API response status for Katana order ${katanaOrderId}:`, response.status);

      if (!response.ok) {
        throw new Error(`Katana API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Serial numbers data for Katana order ${katanaOrderId}:`, data);
      
      const serialNumbers = data.data?.map(item => item.serial_number) || [];
      console.log(`Extracted ${serialNumbers.length} serial numbers for Katana order ${katanaOrderId}:`, serialNumbers);
      
      return serialNumbers;
    } catch (error) {
      console.error(`Error fetching Katana serial numbers for order ${katanaOrderId}:`, error);
      return [];
    }
  }

  getTrackingInfo(order) {
    // First check order notes for tracking info
    if (order.notes) {
      for (const note of order.notes) {
        if (!note.note) continue;
        
        const noteText = note.note;
        console.log('Checking note:', noteText);

        // Look for tracking number patterns
        const patterns = [
          // Look for tracking numbers with explicit labels
          /tracking number[:\s]+(\d+)/i,
          /tracking[:\s]+(\d+)/i,
          /shipped .* tracking[:\s]+(\d+)/i,
          /tracking id[:\s]+(\d+)/i,
          /tracking #[:\s]*(\d+)/i,
          /tracking code[:\s]*(\d+)/i,
          /tracking info[:\s]*(\d+)/i,
          
          // Look for carrier-specific patterns
          /fedex[:\s]*#?\s*(\d+)/i,
          /ups[:\s]*#?\s*(\d+)/i,
          /usps[:\s]*#?\s*(\d+)/i,
          /dhl[:\s]*#?\s*(\d+)/i,
          
          // Look for numbers that match carrier formats
          /\b(1Z[A-Z0-9]{16})\b/i,  // UPS
          /\b(\d{12,14})\b/,        // FedEx
          /\b(94\d{20})\b/,         // USPS
          /\b(82\d{8})\b/,          // USPS
          /\b(\d{30})\b/,           // USPS
          /\b(\d{10})\b/,           // DHL
          
          // General patterns for finding tracking numbers
          /(\d{9,})/,               // Any number 9+ digits
          /[^a-zA-Z0-9](\d{9,})[^a-zA-Z0-9]/,  // 9+ digits surrounded by non-alphanumeric
          /(\d{12,})(?:\s|$)/,      // 12+ digits at end of line
          /[^a-zA-Z0-9](\d{12,})[^a-zA-Z0-9]/  // 12+ digits surrounded by non-alphanumeric
        ];

        for (const pattern of patterns) {
          const match = noteText.match(pattern);
          if (match) {
            const trackingNumber = match[1];
            console.log('Found tracking number:', trackingNumber);
            
            // Determine carrier from note text and tracking number format
            const lowerNote = noteText.toLowerCase();
            let carrier = '';
            
            // Try to determine carrier from note text first
            if (lowerNote.includes('fedex')) carrier = 'fedex';
            else if (lowerNote.includes('ups')) carrier = 'ups';
            else if (lowerNote.includes('usps')) carrier = 'usps';
            else if (lowerNote.includes('dhl')) carrier = 'dhl';
            
            // If carrier not found in note, try to determine from tracking number format
            if (!carrier) {
              if (/^1Z/.test(trackingNumber)) carrier = 'ups';
              else if (/^(94|92|93|95|82)/.test(trackingNumber)) carrier = 'usps';
              else if (/^\d{12}$/.test(trackingNumber) || /^39\d{10}$/.test(trackingNumber)) carrier = 'fedex';
              else if (/^\d{10}$/.test(trackingNumber)) carrier = 'dhl';
            }
            
            return {
              number: trackingNumber,
              url: this.getCarrierTrackingUrl(trackingNumber, carrier),
              provider: carrier || 'unknown'
            };
          }
        }

        // Special case: Look for URLs that might contain tracking numbers
        const urlMatch = noteText.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          const url = urlMatch[0];
          console.log('Found URL:', url);
          
          // Extract tracking number from URL if possible
          const urlTrackingMatch = url.match(/[?&](?:tracking|tracknr|tracknum|tLabels)=([^&]+)/i);
          if (urlTrackingMatch) {
            const trackingNumber = urlTrackingMatch[1];
            console.log('Found tracking number in URL:', trackingNumber);
            
            // Try to determine carrier from URL
            let carrier = '';
            if (url.includes('fedex.com')) carrier = 'fedex';
            else if (url.includes('ups.com')) carrier = 'ups';
            else if (url.includes('usps.com')) carrier = 'usps';
            else if (url.includes('dhl.com')) carrier = 'dhl';
            
            return {
              number: trackingNumber,
              url: url,
              provider: carrier || 'unknown'
            };
          }
        }
      }
    }

    // Fallback to meta_data check
    const trackingMeta = order.meta_data?.find(meta => 
      meta.key === '_wc_shipment_tracking_items' || 
      meta.key === '_aftership_tracking_number' ||
      meta.key === 'tracking_number' ||
      meta.key === '_tracking_number' ||
      meta.key === '_tracking_provider' ||
      meta.key === '_tracking_link'
    );

    if (trackingMeta) {
      try {
        let trackingNumber = '';
        let trackingUrl = '';
        let provider = '';

        if (trackingMeta.key === '_wc_shipment_tracking_items') {
          const trackingItems = typeof trackingMeta.value === 'string' 
            ? JSON.parse(trackingMeta.value) 
            : trackingMeta.value;

          if (Array.isArray(trackingItems) && trackingItems.length > 0) {
            trackingNumber = trackingItems[0].tracking_number;
            provider = trackingItems[0].tracking_provider;
            trackingUrl = trackingItems[0].tracking_url || this.getCarrierTrackingUrl(trackingNumber, provider);
          }
        } else {
          trackingNumber = trackingMeta.value;
          trackingUrl = this.getCarrierTrackingUrl(trackingNumber);
        }

        return trackingNumber ? { number: trackingNumber, url: trackingUrl, provider: provider || 'unknown' } : null;
      } catch (error) {
        console.error('Error parsing tracking info:', error);
        return null;
      }
    }

    return null;
  }

  getCarrierTrackingUrl(trackingNumber, provider = '') {
    provider = provider.toLowerCase();
    
    // Common carriers tracking URLs
    const carriers = {
      'usps': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'dhl': `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    };

    // Try to guess carrier from tracking number format if not provided
    if (!provider || provider === 'unknown') {
      if (/^(94|92|93|95|82)/.test(trackingNumber)) {
        return carriers.usps;
      } else if (/^1Z/.test(trackingNumber)) {
        return carriers.ups;
      } else if (/^\d{12}$/.test(trackingNumber) || /^39\d{10}$/.test(trackingNumber)) {
        return carriers.fedex;
      } else if (/^\d{10}$/.test(trackingNumber)) {
        return carriers.dhl;
      }
    }

    // If we have a known provider, use its URL
    if (carriers[provider]) {
      return carriers[provider];
    }

    // Default to Google search if we can't determine the carrier
    return `https://www.google.com/search?q=${trackingNumber}+tracking`;
  }

  async testConnection() {
    console.log("Testing API connection...");
    try {
      const url = this.getAuthenticatedUrl("/products", { per_page: 1 });
      await this.makeRequest(url);
      console.log("Connection test successful");
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      throw error;
    }
  }

  showLoading() {
    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    if (loading) loading.classList.remove("hidden");
    if (error) error.classList.add("hidden");
  }

  hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.classList.add("hidden");
  }

  showError(message) {
    const errorElement = document.getElementById("error");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("hidden");
    }
    this.hideLoading();
  }

  initializeMissive() {
    // Initialize Missive iframe integration
    console.log("Initializing Missive integration...");
    
    if (window.Missive) {
      console.log("Missive API detected");
      window.Missive.on("ready", () => {
        console.log("Missive iframe ready");
        // Hide any loading states when Missive is ready
        this.hideLoading();
      });
      
      window.Missive.on("error", (error) => {
        console.error("Missive error:", error);
      });
    } else {
      console.log("Missive API not detected - running in standalone mode");
      // If not in Missive, hide loading after a short delay
      setTimeout(() => {
        this.hideLoading();
      }, 1000);
    }
  }
}

// Initialize the app and handle any errors
try {
  console.log("Starting application...");
  console.log("App version: 2.0 - Customer Info Update");
  window.app = new MissWooApp();
  
  // Ensure loading state is cleared after initialization
  setTimeout(() => {
    const loading = document.getElementById("loading");
    if (loading && !loading.classList.contains("hidden")) {
      console.log("Clearing loading state after timeout");
      loading.classList.add("hidden");
    }
  }, 2000);
} catch (error) {
  console.error("Failed to start application:", error);
  const errorDiv = document.getElementById("error");
  if (errorDiv) {
    errorDiv.textContent = "Failed to start application: " + error.message;
    errorDiv.classList.remove("hidden");
  }
}