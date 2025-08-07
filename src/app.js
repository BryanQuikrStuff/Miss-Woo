// Miss-Woo Frontend Application
// VERSION V2021a - Major Version Backup

class MissWooApp {
  constructor() {
    try {
      // Initialize API endpoints
      this.apiBaseUrl = window.config?.woocommerce?.apiBaseUrl;
      this.consumerKey = window.config?.woocommerce?.consumerKey;
      this.consumerSecret = window.config?.woocommerce?.consumerSecret;
      this.siteUrl = window.config?.woocommerce?.siteUrl;
      
      // Katana MRP API configuration
      this.katanaApiBaseUrl = window.config?.katana?.apiBaseUrl;
      this.katanaApiKey = window.config?.katana?.apiKey;
      
      // Validate required configuration
      if (!this.apiBaseUrl || !this.consumerKey || !this.consumerSecret) {
        throw new Error("Missing required WooCommerce configuration");
      }
      
      // Environment detection
      this.isMissiveEnvironment = this.detectMissiveEnvironment();
      this.autoSearchEnabled = this.isMissiveEnvironment;
      
      // Version
      this.version = this.getVersion();
      
      // Search state
      this.lastSearchedEmail = null;
      this.emailCache = new Map();
      this.searchDebounceTimer = null;
      this.visibleEmails = new Set();
      
      // Store all matched orders
      this.allOrders = [];
      
      // Cache-busting for Missive (10-minute cache workaround)
      this.cacheBuster = Date.now();
      
      // CORS headers for better Missive integration
      this.corsHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      this.hideLoading();
      this.initialize();
    } catch (error) {
      console.error("Failed to initialize MissWooApp:", error);
      this.showError(`Configuration error: ${error.message}`);
    }
  }

  getVersion() {
    return 'V2039';
  }

  detectMissiveEnvironment() {
    // Enhanced detection - check multiple indicators
    const hasMissiveAPI = typeof window !== 'undefined' && window.Missive;
    const hasMissiveScript = typeof window !== 'undefined' && document.querySelector('script[src*="missive"]');
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    const urlContainsMissive = typeof window !== 'undefined' && window.location.href.includes('missive');
    const hasMissiveUI = typeof window !== 'undefined' && document.querySelector('[data-missive]');
    
    // More permissive detection - if any Missive indicator is present
    const isMissive = hasMissiveAPI || hasMissiveScript || isInIframe || urlContainsMissive || hasMissiveUI;
    
    console.log("🔍 === MISSIVE ENVIRONMENT DETECTION ===");
    console.log("hasMissiveAPI:", hasMissiveAPI);
    console.log("hasMissiveScript:", hasMissiveScript);
    console.log("isInIframe:", isInIframe);
    console.log("urlContainsMissive:", urlContainsMissive);
    console.log("hasMissiveUI:", hasMissiveUI);
    console.log("Final result:", isMissive);
    console.log("🔍 === DETECTION END ===");
    
    return isMissive;
  }

  async initialize() {
    console.log("Initializing Miss-Woo application...");
    console.log(`Environment: ${this.isMissiveEnvironment ? 'Missive' : 'Web'}`);
    console.log(`Auto-search: ${this.autoSearchEnabled ? 'Enabled' : 'Disabled'}`);
    
    // Clear loading state immediately at start
    this.hideLoading();
    
    try {
      await this.bindEvents();
      await this.initializeMissive();
      this.setupCleanup(); // Setup proper cleanup
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
    
    // Multiple fallbacks: Ensure loading is cleared after timeouts
    setTimeout(() => {
      console.log("Fallback 1: Clearing loading state after 1 second");
      this.hideLoading();
    }, 1000);
    
    setTimeout(() => {
      console.log("Fallback 2: Clearing loading state after 3 seconds");
      this.hideLoading();
    }, 3000);
    
    setTimeout(() => {
      console.log("Fallback 3: Clearing loading state after 5 seconds");
      this.hideLoading();
    }, 5000);
  }

  async bindEvents() {
    console.log("Binding events...");
    try {
      const searchBtn = document.getElementById("searchBtn");
      const searchInput = document.getElementById("orderSearch");

      if (!searchInput) {
        throw new Error("Required DOM elements not found");
      }

      // Bind search button click
      if (searchBtn) {
        searchBtn.addEventListener("click", () => this.handleSearch());
      }

      // Bind search input enter key
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleSearch();
        }
      });

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

    // Clear previous results and errors
    this.clearPreviousResults();
    
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

  clearPreviousResults() {
    // Clear error messages
    const errorElement = document.getElementById("error");
    if (errorElement) {
      errorElement.classList.add("hidden");
      errorElement.textContent = "";
    }
    
    // Clear results
    const resultsContainer = document.getElementById("results");
    if (resultsContainer) {
      resultsContainer.innerHTML = "";
    }
    
    // Clear any "No orders found" messages
    const noOrdersElement = document.querySelector('.no-orders');
    if (noOrdersElement) {
      noOrdersElement.remove();
    }
    
    // Reset the allOrders array
    this.allOrders = [];
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
    // Ensure we have a valid base URL
    if (!this.apiBaseUrl) {
      throw new Error("API base URL is not configured");
    }
    
    // Ensure the base URL ends with a slash for proper concatenation
    const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl : this.apiBaseUrl + '/';
    const fullUrl = baseUrl + endpoint.replace(/^\//, ''); // Remove leading slash if present
    
    try {
      const url = new URL(fullUrl);
      url.searchParams.set('consumer_key', this.consumerKey);
      url.searchParams.set('consumer_secret', this.consumerSecret);
      
      // Add additional parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      console.log("Generated URL:", url.toString());
      return url.toString();
    } catch (error) {
      console.error("Failed to construct URL:", error);
      throw new Error(`Invalid URL construction: ${error.message}`);
    }
  }

  async makeRequest(url, options = {}) {
    console.log("Making request to:", url);
    
    // Add cache-busting parameter for Missive environment
    const separator = url.includes('?') ? '&' : '?';
    const cacheBustedUrl = this.isMissiveEnvironment 
      ? `${url}${separator}_cb=${this.cacheBuster}`
      : url;
    
    try {
      const response = await fetch(cacheBustedUrl, {
        mode: 'cors',
        credentials: 'omit', // Don't send cookies for CORS
        headers: {
          ...this.corsHeaders,
          ...options.headers
        },
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
    if (this.allOrders.length === 0) {
      this.hideLoading();
      this.showError("No orders found");
      return;
    }

    const resultsContainer = document.getElementById("results");
    if (!resultsContainer) {
      this.hideLoading();
      return;
    }

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
    
    // Hide loading only after everything is displayed
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
    if (loading) {
      loading.innerHTML = 'Loading<span class="loading-dots"></span>';
      loading.classList.remove("hidden");
    }
  }

  hideLoading() {
    console.log("hideLoading() called");
    const loading = document.getElementById("loading");
    if (loading) {
      loading.classList.add("hidden");
      console.log("Loading element hidden");
    } else {
      console.log("Loading element not found");
    }
    
    // Also try to hide any visible loading elements directly
    const allLoadingElements = document.querySelectorAll('.loading');
    allLoadingElements.forEach(el => {
      el.classList.add("hidden");
      console.log("Hidden loading element:", el);
    });
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
      // Clear loading state immediately for standalone mode
      this.hideLoading();
      
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
      
      // Always clear loading state after re-check
      this.hideLoading();
    }, 1000);
  }

  updateUIForEnvironment() {
    console.log("🔧 === UI UPDATE DEBUG ===");
    console.log("Environment detection:", this.isMissiveEnvironment);
    console.log("Auto-search enabled:", this.autoSearchEnabled);
    console.log("Search section found:", !!document.querySelector('.search-section'));
    
    // Update header with version number
    this.updateHeaderWithVersion();
    
    const searchSection = document.querySelector('.search-section');
    console.log("Search section element:", searchSection);

    if (this.isMissiveEnvironment) {
      console.log("🔧 Setting up Missive UI...");
      // Missive environment: Show auto-search indicator with manual fallback
      if (searchSection) {
        searchSection.innerHTML = `
          <div class="auto-search-indicator" style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #4CAF50;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="font-size: 20px;">🔍</span>
              <div>
                <strong style="color: #2E7D32;">Auto-Search Enabled</strong>
                <br><small style="color: #666;">Automatically searches when you focus on emails in Missive</small>
              </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button onclick="window.app.tryGetCurrentEmail()" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                🔍 Trigger Auto-Search Now
              </button>
              <button onclick="window.app.debugMissiveStatus()" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                🔧 Debug Status
              </button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
              <strong>Debug Info:</strong> Auto-search is ${this.autoSearchEnabled ? 'ENABLED' : 'DISABLED'} | 
              Missive API: ${window.Missive ? 'AVAILABLE' : 'NOT AVAILABLE'}
            </div>
          </div>
          <div class="manual-search-fallback" style="margin-top: 15px;">
            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #ffeaa7;">
              <strong>Manual Search Fallback:</strong> If auto-search doesn't work, use this
            </div>
            <input type="text" id="orderSearch" placeholder="Search orders by ID or customer email..." class="search-input" />
            <button id="searchBtn" class="search-btn">Search</button>
          </div>
        `;
        console.log("✅ Missive UI updated successfully");
        
        // Re-bind event listeners for the new elements
        const newSearchBtn = document.getElementById("searchBtn");
        const newSearchInput = document.getElementById("orderSearch");
        
        if (newSearchBtn) {
          newSearchBtn.onclick = () => this.handleSearch();
          console.log("✅ Search button event bound");
        }
        if (newSearchInput) {
          newSearchInput.onkeypress = (e) => {
            if (e.key === "Enter") this.handleSearch();
          };
          console.log("✅ Search input event bound");
        }
      } else {
        console.log("❌ Search section not found for Missive UI");
      }
    } else {
      console.log("🔧 Setting up Web UI...");
      // Web environment: Show manual search UI only
      if (searchSection) {
        searchSection.innerHTML = `
          <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #ffeaa7;">
            <strong>Web Mode:</strong> Manual search only. 
            <button onclick="window.app.forceMissiveEnvironment()" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">
              🔧 Force Missive Mode
            </button>
          </div>
          <input type="text" id="orderSearch" placeholder="Search orders by ID or customer email..." class="search-input" />
          <button id="searchBtn" class="search-btn">Search</button>
        `;
        console.log("✅ Web UI updated successfully");
        
        // Re-bind event listeners
        const searchBtn = document.getElementById("searchBtn");
        const searchInput = document.getElementById("orderSearch");
        
        if (searchBtn) {
          searchBtn.onclick = () => this.handleSearch();
          console.log("✅ Search button event bound");
        }
        if (searchInput) {
          searchInput.onkeypress = (e) => {
            if (e.key === "Enter") this.handleSearch();
          };
          console.log("✅ Search input event bound");
        }
      } else {
        console.log("❌ Search section not found for Web UI");
      }
    }
    
    console.log("🔧 === UI UPDATE DEBUG END ===");
  }

  updateHeaderWithVersion() {
    const header = document.querySelector('.app-header h1');
    if (header) {
      // Check if we're in development environment (localhost)
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const devIndicator = isDevelopment ? ' DEV' : '';
      header.innerHTML = `Miss-Woo${devIndicator} <span style="font-size: 0.6em; color: #666; font-weight: normal;">${this.version}</span>`;
    }
  }

  setupMissiveEventListeners() {
    if (!window.Missive) return;

    console.log("🔧 Setting up Missive event listeners...");

    Missive.on("ready", () => {
      console.log("✅ Missive ready - attempting to get current email");
      this.hideLoading();
      
      // Try to get current email immediately when Missive is ready
      this.tryGetCurrentEmail();
      
      // Also try after a short delay in case the API isn't ready yet
      setTimeout(() => this.tryGetCurrentEmail(), 1000);
      setTimeout(() => this.tryGetCurrentEmail(), 3000);
      setTimeout(() => this.tryGetCurrentEmail(), 5000);
    });

    Missive.on("error", (error) => {
      console.error("❌ Missive error:", error);
    });

    // Set up auto-search for email focus with more aggressive event handling
    Missive.on("email:focus", (data) => {
      console.log("📧 Missive email:focus event:", data);
      this.handleEmailFocus(data);
    });
    
    Missive.on("email:open", (data) => {
      console.log("📧 Missive email:open event:", data);
      this.handleEmailOpen(data);
    });
    
    Missive.on("thread:focus", (data) => {
      console.log("📧 Missive thread:focus event:", data);
      this.handleThreadFocus(data);
    });
    
    // Add conversation change listener for better auto-search
    Missive.on("change:conversations", (data) => {
      console.log("📧 Missive change:conversations event:", data);
      this.handleConversationChange(data);
    });
    
    // Additional events for better coverage
    Missive.on("conversation:focus", (data) => {
      console.log("📧 Missive conversation:focus event:", data);
      this.handleConversationChange(data);
    });
    
    Missive.on("conversation:open", (data) => {
      console.log("📧 Missive conversation:open event:", data);
      this.handleConversationChange(data);
    });
    
    // Add more events that might be available
    Missive.on("email:select", (data) => {
      console.log("📧 Missive email:select event:", data);
      this.handleEmailFocus(data);
    });
    
    Missive.on("thread:select", (data) => {
      console.log("📧 Missive thread:select event:", data);
      this.handleThreadFocus(data);
    });
    
    // Try to get current email periodically in case events don't fire
    setInterval(() => {
      if (this.isMissiveEnvironment && this.autoSearchEnabled) {
        console.log("⏰ Periodic check for current email...");
        this.tryGetCurrentEmail();
      }
    }, 3000); // Check every 3 seconds (more frequent)
    
    // Also try on window focus in case user switches back to Missive
    window.addEventListener('focus', () => {
      if (this.isMissiveEnvironment && this.autoSearchEnabled) {
        console.log("🪟 Window focused, checking for current email...");
        setTimeout(() => this.tryGetCurrentEmail(), 500);
      }
    });
  }

  async tryGetCurrentEmail() {
    try {
      console.log("🔍 === AUTO-SEARCH DEBUG ===");
      console.log("Trying to get current email from Missive API...");
      console.log("Missive object available:", !!window.Missive);
      console.log("Available Missive methods:", Object.keys(window.Missive || {}));
      console.log("Auto-search enabled:", this.autoSearchEnabled);
      
      // Try multiple methods to get the current email
      let email = null;
      
      // Method 1: Try Missive.getCurrentEmail() if available
      if (window.Missive && Missive.getCurrentEmail) {
        try {
          console.log("📧 Method 1: Trying Missive.getCurrentEmail()...");
          const emailData = await Missive.getCurrentEmail();
          console.log("📧 getCurrentEmail raw data:", emailData);
          email = this.extractEmailFromData(emailData);
          console.log("📧 Method 1 - getCurrentEmail result:", email);
        } catch (error) {
          console.log("❌ Method 1 failed:", error);
        }
      } else {
        console.log("❌ Missive.getCurrentEmail() not available");
      }
      
      // Method 2: Try Missive.getCurrentThread() if available
      if (!email && window.Missive && Missive.getCurrentThread) {
        try {
          console.log("📧 Method 2: Trying Missive.getCurrentThread()...");
          const threadData = await Missive.getCurrentThread();
          console.log("📧 getCurrentThread raw data:", threadData);
          email = this.extractEmailFromData(threadData);
          console.log("📧 Method 2 - getCurrentThread result:", email);
        } catch (error) {
          console.log("❌ Method 2 failed:", error);
        }
      } else if (!email) {
        console.log("❌ Missive.getCurrentThread() not available");
      }
      
      // Method 3: Try Missive.getCurrentConversation() if available
      if (!email && window.Missive && Missive.getCurrentConversation) {
        try {
          console.log("📧 Method 3: Trying Missive.getCurrentConversation()...");
          const conversationData = await Missive.getCurrentConversation();
          console.log("📧 getCurrentConversation raw data:", conversationData);
          email = this.extractEmailFromData(conversationData);
          console.log("📧 Method 3 - getCurrentConversation result:", email);
        } catch (error) {
          console.log("❌ Method 3 failed:", error);
        }
      } else if (!email) {
        console.log("❌ Missive.getCurrentConversation() not available");
      }
      
      // Method 4: Try to get from URL parameters or other sources
      if (!email) {
        console.log("📧 Method 4: Trying to extract email from URL or other sources...");
        const urlParams = new URLSearchParams(window.location.search);
        const emailParam = urlParams.get('email');
        if (emailParam) {
          email = emailParam;
          console.log("📧 Found email in URL parameter:", email);
        }
      }
      
      if (email) {
        console.log("✅ Found current email:", email);
        console.log("🔍 Email validation result:", this.isValidEmailForSearch(email));
        if (this.isValidEmailForSearch(email)) {
          await this.performAutoSearch(email);
        } else {
          console.log("❌ Email failed validation, skipping auto-search");
        }
      } else {
        console.log("❌ No current email found from any method");
        console.log("💡 Auto-search will rely on Missive events only");
      }
      
      console.log("🔍 === AUTO-SEARCH DEBUG END ===");
    } catch (error) {
      console.error("❌ Error getting current email:", error);
    }
  }

  async handleEmailFocus(data) {
    console.log("📧 Email focus event triggered:", data);
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      console.log("📧 Extracted email from focus event:", email);
      if (email && email !== this.lastSearchedEmail) {
        console.log("🔍 Email focused, auto-searching:", email);
        await this.performAutoSearch(email);
      } else {
        console.log("❌ Email focus: No valid email or already searched");
      }
    } else {
      console.log("❌ Auto-search disabled, ignoring email focus");
    }
  }

  async handleEmailOpen(data) {
    console.log("📧 Email open event triggered:", data);
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      console.log("📧 Extracted email from open event:", email);
      if (email && email !== this.lastSearchedEmail) {
        console.log("🔍 Email opened, auto-searching:", email);
        await this.performAutoSearch(email);
      } else {
        console.log("❌ Email open: No valid email or already searched");
      }
    } else {
      console.log("❌ Auto-search disabled, ignoring email open");
    }
  }

  async handleThreadFocus(data) {
    console.log("📧 Thread focus event triggered:", data);
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      console.log("📧 Extracted email from thread focus:", email);
      if (email && email !== this.lastSearchedEmail) {
        console.log("🔍 Thread focused, auto-searching:", email);
        await this.performAutoSearch(email);
      } else {
        console.log("❌ Thread focus: No valid email or already searched");
      }
    } else {
      console.log("❌ Auto-search disabled, ignoring thread focus");
    }
  }

  async handleConversationChange(data) {
    console.log("📧 Conversation change event triggered:", data);
    if (this.autoSearchEnabled) {
      const email = this.extractEmailFromData(data);
      console.log("📧 Extracted email from conversation change:", email);
      if (email && email !== this.lastSearchedEmail) {
        console.log("🔍 Conversation changed, auto-searching:", email);
        await this.performAutoSearch(email);
      } else {
        console.log("❌ Conversation change: No valid email or already searched");
      }
    } else {
      console.log("❌ Auto-search disabled, ignoring conversation change");
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
    console.log("🔍 Extracting email from data:", data);
    
    if (!data) {
      console.log("❌ No data provided");
      return null;
    }

    // Try different data structures
    if (data.email) {
      console.log("✅ Found email in data.email:", data.email);
      return data.email;
    }
    
    if (data.recipient && data.recipient.email) {
      console.log("✅ Found email in data.recipient.email:", data.recipient.email);
      return data.recipient.email;
    }
    
    if (data.thread && data.thread.participants) {
      const participant = data.thread.participants.find(p => p.role === 'to');
      if (participant && participant.email) {
        console.log("✅ Found email in thread.participants:", participant.email);
        return participant.email;
      }
    }
    
    if (data.participants) {
      const participant = data.participants.find(p => p.role === 'to');
      if (participant && participant.email) {
        console.log("✅ Found email in participants:", participant.email);
        return participant.email;
      }
    }
    
    // Try to extract from text content
    if (data.text) {
      const email = this.extractEmailFromString(data.text);
      if (email) {
        console.log("✅ Found email in data.text:", email);
        return email;
      }
    }
    
    if (data.content) {
      const email = this.extractEmailFromString(data.content);
      if (email) {
        console.log("✅ Found email in data.content:", email);
        return email;
      }
    }
    
    if (data.subject) {
      const email = this.extractEmailFromString(data.subject);
      if (email) {
        console.log("✅ Found email in data.subject:", email);
        return email;
      }
    }
    
    // Try to extract from any string properties
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('@')) {
        const email = this.extractEmailFromString(value);
        if (email) {
          console.log(`✅ Found email in data.${key}:`, email);
          return email;
        }
      }
    }

    console.log("❌ No email found in data structure");
    return null;
  }

  isValidEmailForSearch(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    // Filter out @quikrstuff.com emails
    if (email.toLowerCase().includes('@quikrstuff.com')) {
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
    
    // Validate email before searching
    if (!this.isValidEmailForSearch(email)) {
      console.log(`Email validation failed for: ${email}`);
      return;
    }
    
    // Clear previous results before starting new search
    this.clearPreviousResults();
    
    // Debounce auto-search to prevent rapid successive calls
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    this.searchDebounceTimer = setTimeout(async () => {
      this.lastSearchedEmail = email;
      this.showLoading();
      
      try {
        // Check cache first
        if (this.emailCache.has(email)) {
          console.log(`Using cached results for: ${email}`);
          this.allOrders = this.emailCache.get(email);
          await this.displayOrdersList();
          return;
        }
        
        await this.searchOrdersByEmail(email);
        
        // Cache the results
        if (this.allOrders.length > 0) {
          this.emailCache.set(email, [...this.allOrders]);
          this.cleanupCache(); // Manage cache size
        }
      } catch (error) {
        console.error("Auto-search failed:", error);
        this.showError("Auto-search failed: " + error.message);
      }
    }, 300); // 300ms debounce delay
  }

  cleanupCache() {
    // Keep only the last 10 cached emails to prevent memory issues
    const maxCacheSize = 10;
    if (this.emailCache.size > maxCacheSize) {
      const entries = Array.from(this.emailCache.entries());
      const toRemove = entries.slice(0, entries.length - maxCacheSize);
      toRemove.forEach(([email]) => {
        this.emailCache.delete(email);
      });
      console.log(`Cleaned up cache, removed ${toRemove.length} old entries`);
    }
  }

  async preloadVisibleEmails() {
    if (!this.isMissiveEnvironment) return;
    
    try {
      // Get visible emails from Missive (if available)
      if (window.Missive && window.Missive.getVisibleEmails) {
        const visibleEmails = await window.Missive.getVisibleEmails();
        if (visibleEmails && Array.isArray(visibleEmails)) {
          for (const emailData of visibleEmails) {
            const email = this.extractEmailFromData(emailData);
            if (email && this.isValidEmailForSearch(email)) {
              this.visibleEmails.add(email);
              // Preload data for visible emails
              await this.preloadEmailData(email);
            }
          }
        }
      }
    } catch (error) {
      console.log("Preloading visible emails failed:", error);
    }
  }

  async preloadEmailData(email) {
    if (this.emailCache.has(email)) return; // Already cached
    
    try {
      console.log(`Preloading data for: ${email}`);
      await this.searchOrdersByEmail(email);
      if (this.allOrders.length > 0) {
        this.emailCache.set(email, [...this.allOrders]);
      }
    } catch (error) {
      console.log(`Preloading failed for ${email}:`, error);
    }
  }

  cleanup() {
    // Clear timers
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    
    // Clear cache
    this.emailCache.clear();
    this.visibleEmails.clear();
    
    // Remove event listeners if they exist
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("orderSearch");
    
    if (searchBtn) {
      searchBtn.removeEventListener("click", this.handleSearch.bind(this));
    }
    
    if (searchInput) {
      searchInput.removeEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleSearch();
        }
      });
    }
    
    console.log("Cleanup completed");
  }

  // Add cleanup on page unload (using beforeunload instead of unload)
  setupCleanup() {
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  debugMissiveStatus() {
    console.log("🔧 === MISSIVE DEBUG STATUS ===");
    console.log("Environment detection:", this.isMissiveEnvironment);
    console.log("Auto-search enabled:", this.autoSearchEnabled);
    console.log("Missive object available:", !!window.Missive);
    console.log("Missive methods available:", Object.keys(window.Missive || {}));
    console.log("Last searched email:", this.lastSearchedEmail);
    console.log("Cache size:", this.emailCache.size);
    console.log("Current URL:", window.location.href);
    console.log("User agent:", navigator.userAgent);
    
    // Test Missive API methods
    if (window.Missive) {
      console.log("🔧 Testing Missive API methods...");
      
      // Test each method
      const methods = ['getCurrentEmail', 'getCurrentThread', 'getCurrentConversation', 'getVisibleEmails'];
      methods.forEach(method => {
        if (typeof window.Missive[method] === 'function') {
          console.log(`✅ ${method} is available`);
        } else {
          console.log(`❌ ${method} is not available`);
        }
      });
    }
    
    console.log("🔧 === DEBUG STATUS END ===");
    
    // Show a user-friendly message
    alert(`Missive Debug Status:\n\n` +
          `Environment: ${this.isMissiveEnvironment ? 'Missive' : 'Web'}\n` +
          `Auto-search: ${this.autoSearchEnabled ? 'Enabled' : 'Disabled'}\n` +
          `Missive API: ${window.Missive ? 'Available' : 'Not Available'}\n` +
          `Available methods: ${Object.keys(window.Missive || {}).join(', ')}\n\n` +
          `Check console for detailed debug info.`);
  }

  forceMissiveEnvironment() {
    console.log("🔧 === FORCING MISSIVE ENVIRONMENT ===");
    
    // Force Missive environment detection
    this.isMissiveEnvironment = true;
    this.autoSearchEnabled = true;
    
    console.log("Environment forced to Missive");
    console.log("Auto-search enabled:", this.autoSearchEnabled);
    
    // Re-initialize Missive
    this.initializeMissive();
    
    // Update UI
    this.updateUIForEnvironment();
    
    console.log("🔧 === FORCE COMPLETE ===");
    
    // Show user feedback
    alert("Missive environment forced! Auto-search should now be available.");
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