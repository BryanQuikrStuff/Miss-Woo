// Miss-Woo Frontend Application
// VERSION 2.0 - Clean and Optimized
import config from './config.js';

class MissWooApp {
  constructor() {
    console.log("🚀 Miss-Woo v2.0 - Clean and Optimized 🚀");
    
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
    
    // Auto-search configuration - detect Missive environment with multiple checks
    this.isMissiveEnvironment = this.detectMissiveEnvironment();
    this.autoSearchEnabled = this.isMissiveEnvironment; // Enable auto-search only in Missive
    this.lastSearchedEmail = null; // Prevent duplicate searches
    
    // Initialize after constructor
    this.initialize();
  }

  detectMissiveEnvironment() {
    // Multiple detection methods for Missive environment
    const checks = [
      // Check if Missive API is available
      typeof window !== 'undefined' && window.Missive,
      // Check if we're in an iframe (common for Missive)
      typeof window !== 'undefined' && window.self !== window.top,
      // Check for Missive-specific URL patterns
      typeof window !== 'undefined' && window.location.href.includes('missive'),
      // Check for Missive iframe script
      typeof window !== 'undefined' && document.querySelector('script[src*="missive.com"]')
    ];
    
    const isMissive = checks.some(check => check);
    console.log("Missive environment detection:", {
      windowMissive: typeof window !== 'undefined' && window.Missive,
      inIframe: typeof window !== 'undefined' && window.self !== window.top,
      urlContainsMissive: typeof window !== 'undefined' && window.location.href.includes('missive'),
      hasMissiveScript: typeof window !== 'undefined' && document.querySelector('script[src*="missive.com"]'),
      finalResult: isMissive
    });
    
    return isMissive;
  }

  async initialize() {
    console.log("Initializing Miss-Woo application...");
    console.log(`Environment: ${this.isMissiveEnvironment ? 'Missive' : 'Web'}`);
    console.log(`Auto-search: ${this.autoSearchEnabled ? 'Enabled' : 'Disabled'}`);
    
    try {
      await this.bindEvents();
      await this.initializeMissive();
      // Only test connection if not in Missive environment
      if (!this.isMissiveEnvironment) {
        await this.testConnection();
      }
      console.log("Application initialized successfully");
      
      // Always clear loading state after initialization
      this.hideLoading();
    } catch (error) {
      console.error("Initialization failed:", error);
      this.showError("Failed to initialize application: " + error.message);
      // Clear loading state even on error
      this.hideLoading();
    }
  }

  async bindEvents() {
    console.log("Binding events...");
    try {
      const searchBtn = document.getElementById("searchBtn");
      const searchInput = document.getElementById("orderSearch");

      if (!searchInput) {
        throw new Error("Required DOM elements not found");
      }

      // Configure UI based on environment
      this.updateUIForEnvironment();

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
      let allOrders = [];
      let page = 1;
      const maxPages = 5; // Search up to 5 pages to find orders

      while (page <= maxPages) {
        console.log(`Searching page ${page}...`);
        const url = this.getAuthenticatedUrl('/orders', {
          search: email,
          per_page: 100,
          page: page
        });
        
        const data = await this.makeRequest(url);
        console.log(`Found ${data.length} orders on page ${page}`);
        
        if (data.length === 0) {
          break; // No more orders to fetch
        }
        
        allOrders = allOrders.concat(data);
        page++;
      }

      console.log(`Total orders found: ${allOrders.length}`);

      // Filter for exact email matches and get the latest 5
      const matchingOrders = allOrders
        .filter(order => {
          const orderEmail = order.billing?.email || '';
          const matches = orderEmail.toLowerCase() === email.toLowerCase();
          console.log(`Checking order ${order.number}: ${orderEmail} against ${email}: ${matches}`);
          return matches;
        })
        .slice(0, 5); // Get latest 5 orders

      console.log(`Total matching orders (latest 5): ${matchingOrders.length}`);

      // Get notes for each order
      for (const order of matchingOrders) {
        try {
          const notesUrl = this.getAuthenticatedUrl(`/orders/${order.id}/notes`);
          const notes = await this.makeRequest(notesUrl);
          order.notes = notes;
        } catch (error) {
          console.error(`Failed to get notes for order ${order.id}:`, error);
          order.notes = [];
        }
      }

      this.allOrders = matchingOrders;
      await this.displayOrdersList();
    } catch (error) {
      console.error("Search orders error:", error);
      this.showError(`Failed to search orders: ${error.message}`);
    }
  }

  getAuthenticatedUrl(endpoint, params = {}) {
    const url = new URL(this.apiBaseUrl + endpoint);
    url.searchParams.set('consumer_key', this.consumerKey);
    url.searchParams.set('consumer_secret', this.consumerSecret);
    
    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    console.log("Generated URL:", url.toString());
    return url.toString();
  }

  async makeRequest(url, options = {}) {
    console.log("Making request to:", url);
    try {
      const response = await fetch(url, {
        mode: 'cors',
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    this.hideLoading();
    
    if (this.allOrders.length === 0) {
      this.showError("No orders found");
      return;
    }

    const resultsContainer = document.getElementById("results");
    if (!resultsContainer) return;

    // Create customer info section
    const customerInfoSection = this.createCustomerInfoSection();
    
    // Create table
    const table = document.createElement("table");
    table.className = "orders-table";
    
    // Create header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["Date", "Order #", "Serial #", "Tracking"];
    
    headers.forEach(headerText => {
      const th = document.createElement("th");
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement("tbody");
    
    for (const order of this.allOrders) {
      const row = document.createElement("tr");
      row.className = "order-row";
      
      // Date
      const dateCell = document.createElement("td");
      const orderDate = new Date(order.date_created);
      dateCell.textContent = orderDate.toLocaleDateString();
      row.appendChild(dateCell);
      
      // Order number (clickable)
      const orderCell = document.createElement("td");
      const orderLink = document.createElement("a");
      orderLink.href = `${this.siteUrl}/wp-admin/post.php?post=${order.id}&action=edit`;
      orderLink.target = "_blank";
      orderLink.textContent = `#${order.number}`;
      orderCell.appendChild(orderLink);
      row.appendChild(orderCell);
      
      // Serial number
      const serialCell = document.createElement("td");
      const serialNumber = await this.getSerialNumber(order);
      serialCell.textContent = serialNumber;
      row.appendChild(serialCell);
      
      // Tracking
      const trackingCell = document.createElement("td");
      const trackingInfo = this.getTrackingInfo(order);
      if (trackingInfo) {
        const trackingLink = document.createElement("a");
        trackingLink.href = trackingInfo.url;
        trackingLink.target = "_blank";
        trackingLink.textContent = trackingInfo.number;
        trackingCell.appendChild(trackingLink);
      } else {
        trackingCell.textContent = "N/A";
      }
      row.appendChild(trackingCell);
      
      tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    
    // Clear and populate results
    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(customerInfoSection);
    resultsContainer.appendChild(table);
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
      console.log(`Getting serial number for WooCommerce order #${order.number}`);
      
      // Get the Katana sales order that matches this WooCommerce order
      const katanaOrder = await this.getKatanaOrder(order.number);
      if (!katanaOrder) {
        console.log(`No Katana order found for WooCommerce order #${order.number}`);
        return "N/A";
      }

      console.log(`Found Katana order ID: ${katanaOrder.id} for WooCommerce order #${order.number}`);

      // Get serial numbers from all sales order rows
      const serialNumbers = await this.getAllSerialNumbersFromOrder(katanaOrder, order.number);
      
      if (serialNumbers && serialNumbers.length > 0) {
        console.log(`Found ${serialNumbers.length} serial number(s) for order #${order.number}:`, serialNumbers);
        return serialNumbers.join(', ');
      } else {
        console.log(`No serial numbers found for order #${order.number}`);
        return "N/A";
      }
    } catch (error) {
      console.error('Error getting serial number:', error);
      return "N/A";
    }
  }

  async getAllSerialNumbersFromOrder(katanaOrder, orderNumber) {
    try {
      console.log(`Looking for serial numbers in Katana order details`);
      
      const allSerialNumbers = [];
      
      // Check if the order has sales_order_rows
      if (katanaOrder.sales_order_rows && Array.isArray(katanaOrder.sales_order_rows)) {
        console.log(`Found sales_order_rows array with ${katanaOrder.sales_order_rows.length} items`);
        
        for (const [index, row] of katanaOrder.sales_order_rows.entries()) {
          console.log(`Examining sales order row ${index + 1}:`, row);
          
          // Use the row.id to fetch serial numbers for this specific row
          if (row.id) {
            console.log(`Fetching serial numbers for row ID: ${row.id}`);
            const serialNumbers = await this.getSerialNumbersForRow(row.id);
            if (serialNumbers && serialNumbers.length > 0) {
              console.log(`Found ${serialNumbers.length} serial number(s) for row ID ${row.id}:`, serialNumbers);
              allSerialNumbers.push(...serialNumbers);
            }
          }
        }
      } else {
        console.log(`No sales_order_rows found in order`);
      }
      
      console.log(`Total serial numbers found: ${allSerialNumbers.length}`);
      return allSerialNumbers;
    } catch (error) {
      console.error('Error extracting serial numbers from order:', error);
      return [];
    }
  }

  async getSerialNumbersForRow(rowId) {
    try {
      console.log(`Fetching serial numbers for row ID: ${rowId}`);
      // Use the row ID as resource_id to get serial numbers
      const url = `${this.katanaApiBaseUrl}/serial_numbers?resource_id=${rowId}&resource_type=SalesOrderRow`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`No serial numbers found for row ID ${rowId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      console.log(`Serial numbers data for row ID ${rowId}:`, data);
      
      if (data.data && Array.isArray(data.data)) {
        // Extract the actual serial_number values from each object
        const serialNumbers = data.data
          .map(item => item.serial_number)
          .filter(Boolean);
        console.log(`Found ${serialNumbers.length} serial numbers for row ID ${rowId}:`, serialNumbers);
        return serialNumbers;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching serial numbers for row ID ${rowId}:`, error);
      return [];
    }
  }

  async getKatanaOrder(wooOrderNumber) {
    try {
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
      return data;
    } catch (error) {
      console.error(`Error fetching full Katana order details for ${katanaOrderId}:`, error);
      return null;
    }
  }

  getTrackingInfo(order) {
    try {
      // Check order notes first
      if (order.notes && Array.isArray(order.notes)) {
        for (const note of order.notes) {
          const noteContent = note.note || '';
          console.log(`Checking note: ${noteContent}`);
          
          // Look for tracking patterns
          const trackingMatch = this.extractTrackingFromText(noteContent);
          if (trackingMatch) {
            console.log(`Found tracking number: ${trackingMatch.number}`);
            return trackingMatch;
          }
        }
      }

      // Check meta_data as fallback
      if (order.meta_data && Array.isArray(order.meta_data)) {
        for (const meta of order.meta_data) {
          if (meta.key && meta.value) {
            const metaValue = String(meta.value);
            const trackingMatch = this.extractTrackingFromText(metaValue);
            if (trackingMatch) {
              console.log(`Found tracking number in meta: ${trackingMatch.number}`);
              return trackingMatch;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting tracking info:', error);
      return null;
    }
  }

  extractTrackingFromText(text) {
    if (!text) return null;

    // First, look for carrier names and extract tracking numbers that follow
    const carrierPatterns = [
      { name: 'USPS', regex: /USPS[^0-9]*(\d{10,22})/i },
      { name: 'FedEx', regex: /FedEx[^0-9]*(\d{10,15})/i },
      { name: 'UPS', regex: /UPS[^0-9]*(\d{10,18})/i },
      { name: 'DHL', regex: /DHL[^0-9]*(\d{10,12})/i }
    ];

    for (const pattern of carrierPatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const trackingNumber = match[1];
        console.log(`Found ${pattern.name} tracking number: ${trackingNumber}`);
        const url = this.getCarrierTrackingUrl(trackingNumber, pattern.name);
        return { number: trackingNumber, url, provider: pattern.name };
      }
    }

    // Fallback: Common tracking number patterns (if no carrier name found)
    const patterns = [
      // USPS - more flexible pattern to catch all USPS tracking numbers
      { regex: /\b9[234]\d{16,22}\b/, provider: 'USPS' },
      // UPS
      { regex: /\b1Z[A-Z0-9]{16}\b/, provider: 'UPS' },
      { regex: /\bT\d{10}\b/, provider: 'UPS' },
      // FedEx
      { regex: /\b\d{12}\b/, provider: 'FedEx' },
      { regex: /\b\d{15}\b/, provider: 'FedEx' },
      // DHL
      { regex: /\b\d{10}\b/, provider: 'DHL' },
      // Generic tracking numbers (fallback)
      { regex: /\b\d{8,22}\b/, provider: '' }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const trackingNumber = match[0];
        console.log(`Found tracking number: ${trackingNumber} (${pattern.provider})`);
        const url = this.getCarrierTrackingUrl(trackingNumber, pattern.provider);
        return { number: trackingNumber, url, provider: pattern.provider };
      }
    }

    return null;
  }

  getCarrierTrackingUrl(trackingNumber, provider = '') {
    const number = trackingNumber.trim();
    
    // USPS - updated pattern to match the new regex
    if (provider === 'USPS' || /^9[234]\d{16,22}$/.test(number)) {
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    }
    
    // UPS
    if (provider === 'UPS' || /^1Z[A-Z0-9]{16}$/.test(number) || /^T\d{10}$/.test(number)) {
      return `https://www.ups.com/track?tracknum=${number}`;
    }
    
    // FedEx
    if (provider === 'FedEx' || /^\d{12}$/.test(number) || /^\d{15}$/.test(number)) {
      return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
    }
    
    // DHL
    if (provider === 'DHL' || /^\d{10}$/.test(number)) {
      return `https://www.dhl.com/en/express/tracking.html?AWB=${number}`;
    }
    
    // Generic - try USPS first
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
  }

  async testConnection() {
    try {
      console.log("Testing WooCommerce connection...");
      const url = this.getAuthenticatedUrl('/orders', { per_page: 1 });
      await this.makeRequest(url);
      console.log("✅ WooCommerce connection successful");
    } catch (error) {
      console.error("❌ WooCommerce connection failed:", error);
      this.showError("Failed to connect to WooCommerce: " + error.message);
    }
  }

  showLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.classList.remove("hidden");
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
  }

  initializeMissive() {
    if (window.Missive) {
      console.log("Missive detected, setting up integration...");
      this.setupMissiveEventListeners();
      // Re-check environment after Missive is ready
      this.recheckMissiveEnvironment();
    } else {
      console.log("Missive not detected, running in standalone mode");
      // Try to detect Missive after a delay in case it loads later
      setTimeout(() => {
        if (window.Missive && !this.isMissiveEnvironment) {
          console.log("Missive detected after delay, updating environment...");
          this.isMissiveEnvironment = true;
          this.autoSearchEnabled = true;
          this.updateUIForEnvironment();
          this.setupMissiveEventListeners();
        }
      }, 2000);
    }
  }

  recheckMissiveEnvironment() {
    // Re-check environment after a short delay
    setTimeout(() => {
      const wasMissive = this.isMissiveEnvironment;
      this.isMissiveEnvironment = this.detectMissiveEnvironment();
      
      if (this.isMissiveEnvironment !== wasMissive) {
        console.log(`Environment changed: ${wasMissive ? 'Missive' : 'Web'} -> ${this.isMissiveEnvironment ? 'Missive' : 'Web'}`);
        this.autoSearchEnabled = this.isMissiveEnvironment;
        this.updateUIForEnvironment();
      }
    }, 1000);
  }

  updateUIForEnvironment() {
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("orderSearch");
    const searchSection = document.querySelector('.search-section');

    if (this.isMissiveEnvironment) {
      // Missive environment: Hide search UI and show auto-search indicator
      if (searchBtn) searchBtn.style.display = 'none';
      if (searchInput) searchInput.style.display = 'none';
      if (searchSection) {
        searchSection.innerHTML = '<div class="auto-search-indicator">🔍 Auto-search enabled - searching when email is focused in Missive</div>';
      }
    } else {
      // Web environment: Show manual search UI
      if (searchBtn) {
        searchBtn.style.display = 'block';
        // Re-bind event listeners
        searchBtn.onclick = () => this.handleSearch();
      }
      if (searchInput) {
        searchInput.style.display = 'block';
        // Re-bind event listeners
        searchInput.onkeypress = (e) => {
          if (e.key === "Enter") this.handleSearch();
        };
      }
    }
  }

  setupMissiveEventListeners() {
    if (!window.Missive) return;

    Missive.on("ready", () => {
      console.log("Missive ready");
      this.hideLoading();
    });

    Missive.on("error", (error) => {
      console.error("Missive error:", error);
    });

    // Set up auto-search for email focus
    Missive.on("email:focus", (data) => this.handleEmailFocus(data));
    Missive.on("email:open", (data) => this.handleEmailOpen(data));
    Missive.on("thread:focus", (data) => this.handleThreadFocus(data));
  }

  async handleEmailFocus(data) {
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      if (email && email !== this.lastSearchedEmail) {
        console.log("Email focused, auto-searching:", email);
        await this.performAutoSearch(email);
      }
    }
  }

  async handleEmailOpen(data) {
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      if (email && email !== this.lastSearchedEmail) {
        console.log("Email opened, auto-searching:", email);
        await this.performAutoSearch(email);
      }
    }
  }

  async handleThreadFocus(data) {
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      if (email && email !== this.lastSearchedEmail) {
        console.log("Thread focused, auto-searching:", email);
        await this.performAutoSearch(email);
      }
    }
  }

  async extractAndSearchEmail(data) {
    const email = this.extractEmailFromData(data);
    if (email) {
      console.log("Extracted email:", email);
      await this.performAutoSearch(email);
    } else {
      console.log("No email found in data");
    }
  }

  extractEmailFromData(data) {
    if (!data) return null;

    // Try different data structures
    if (data.email) return data.email;
    if (data.recipient && data.recipient.email) return data.recipient.email;
    if (data.thread && data.thread.participants) {
      const participant = data.thread.participants.find(p => p.role === 'to');
      if (participant && participant.email) return participant.email;
    }
    if (data.participants) {
      const participant = data.participants.find(p => p.role === 'to');
      if (participant && participant.email) return participant.email;
    }

    // Try to extract from text content
    if (data.text) return this.extractEmailFromString(data.text);
    if (data.content) return this.extractEmailFromString(data.content);
    if (data.subject) return this.extractEmailFromString(data.subject);

    return null;
  }

  extractEmailFromString(text) {
    if (!text) return null;
    
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match ? match[0] : null;
  }

  async getEmailFromMissiveAPI() {
    try {
      if (window.Missive && Missive.getCurrentEmail) {
        const emailData = await Missive.getCurrentEmail();
        return this.extractEmailFromData(emailData);
      }
    } catch (error) {
      console.error("Error getting email from Missive API:", error);
    }
    return null;
  }

  async performAutoSearch(email) {
    if (!email || email === this.lastSearchedEmail) return;
    
    this.lastSearchedEmail = email;
    this.showLoading();
    
    try {
      await this.searchOrdersByEmail(email);
    } catch (error) {
      console.error("Auto-search failed:", error);
      this.showError("Auto-search failed: " + error.message);
    }
  }
}

// Initialize the app and handle any errors
try {
  console.log("Starting Miss-Woo application...");
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