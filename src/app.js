// Miss-Woo Frontend Application
// VERSION V2021a - Major Version Backup

class MissWooApp {
    constructor(config) {
    try {
      // Configuration - handle both old flat structure and new nested structure
      if (config && config.woocommerce) {
        // New nested structure
        this.apiBaseUrl = config.woocommerce.apiBaseUrl;
        this.consumerKey = config.woocommerce.consumerKey;
        this.consumerSecret = config.woocommerce.consumerSecret;
        this.siteUrl = config.woocommerce.siteUrl;
        this.katanaApiBaseUrl = config.katana?.apiBaseUrl;
        this.katanaApiKey = config.katana?.apiKey;
      } else if (config) {
        // Old flat structure (backward compatibility)
        this.apiBaseUrl = config.apiBaseUrl;
        this.consumerKey = config.consumerKey;
        this.consumerSecret = config.consumerSecret;
        this.katanaApiBaseUrl = config.katanaApiBaseUrl;
        this.katanaApiKey = config.katanaApiKey;
      } else {
        throw new Error('Configuration object is required');
      }
      
      // Validate required configuration
      if (!this.apiBaseUrl || !this.consumerKey || !this.consumerSecret) {
        throw new Error('Missing required WooCommerce configuration');
      }
      
      // Environment detection
      this.isMissiveEnvironment = this.detectMissiveEnvironment();
      this.autoSearchEnabled = this.isMissiveEnvironment;
      
      // Bridge configuration
      this.allowedBridgeOrigins = new Set([
        'https://missiveapp.com',
        'https://app.missiveapp.com',
        'https://integrations.missiveapp.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ]);
      
      // Performance optimizations
      this.requestQueue = new Map();
      this.pendingRequests = new Set();
      this.cacheBuster = Date.now();
      this.corsHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      // Caching system
      this.orderCache = new Map();
      this.katanaOrderCache = new Map();
      this.serialNumberCache = new Map();
      this.emailCache = new Map();
      this.cacheExpiry = new Map();
      this.preloadedConversations = new Map();
      this.visibleConversationIds = new Set();
      this.seenConversationIds = new Set();
      this.preloadingInProgress = false;
      this.preloadingDebounceTimer = null;
      this.maxPreloadedConversations = 20;
      this.backgroundTasks = [];
      
      // Cache configuration
      this.cacheConfig = {
        orderCache: 5 * 60 * 1000, // 5 minutes
        katanaCache: 10 * 60 * 1000, // 10 minutes  
        serialCache: 30 * 60 * 1000, // 30 minutes
        emailCache: 2 * 60 * 1000, // 2 minutes
        preloadedCache: 15 * 60 * 1000 // 15 minutes for preloaded data
      };
      
      // Search state management
      this.allOrders = [];
      this.lastSearchedEmail = null;
      this.searchDebounceTimer = null;
      this.lastSearchTime = 0;
      this.minSearchInterval = 500; // Minimum 500ms between searches for same email
      this.searchInProgress = false; // Prevent multiple searches from running simultaneously
      this.activeSearches = new Map(); // Track active searches by email
      
      this.hideLoading();
      this.initialize();
    } catch (error) {
      console.error("Failed to initialize MissWooApp:", error);
      this.showError(`Configuration error: ${error.message}`);
    }
  }

  // Legacy Missive bridge code removed - now using JS API integration

  async initializeMissiveAPI() {
    console.log("🔧 Initializing Missive API integration...");
    
    try {
      // Wait for Missive API to be available
      let retries = 0;
      const maxRetries = 10;
      
      while (!window.Missive && retries < maxRetries) {
        console.log(`⏳ Waiting for Missive API... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }
      
      if (!window.Missive) {
        console.error("❌ Missive API not available after timeout");
        this.setStatus("Missive API not available", 'error');
        return;
      }
      
      console.log("✅ Missive API detected");
      
      // Set up event listeners
      this.setupMissiveEventListeners();
      
      // Try to get current conversation/email
      await this.tryGetCurrentContext();
      
    } catch (error) {
      console.error("❌ Missive API initialization failed:", error);
      this.setStatus("Missive API initialization failed", 'error');
    }
  }

  setupMissiveEventListeners() {
    console.log("🔧 Setting up Missive event listeners...");
    
    try {
      // Listen for conversation changes
      if (Missive.on) {
        Missive.on('change:conversations', (data) => {
          console.log("📧 Conversation changed:", data);
          this.handleConversationChange(data);
        });
        
        console.log("✅ change:conversations listener set up");
      }
      
      // Listen for email focus (if available)
      if (Missive.on) {
        Missive.on('email:focus', (data) => {
          console.log("📧 Email focused:", data);
          this.handleEmailFocus(data);
        });
        
        console.log("✅ email:focus listener set up");
      }
      
    } catch (error) {
      console.error("❌ Failed to set up Missive event listeners:", error);
    }
  }

  async tryGetCurrentContext() {
    try {
      console.log("🔍 Attempting to get current context...");
      
      // Try to get current conversation
      if (Missive.getCurrentConversation) {
        const conversation = await Missive.getCurrentConversation();
        if (conversation) {
          console.log("📧 Current conversation:", conversation);
          this.handleConversationChange(conversation);
        }
      }
      
      // Try to get current email
      if (Missive.getCurrentEmail) {
        const email = await Missive.getCurrentEmail();
        if (email) {
          console.log("📧 Current email:", email);
          this.handleEmailFocus(email);
        }
      }
      
    } catch (error) {
      console.error("❌ Failed to get current context:", error);
    }
  }

  handleConversationChange(data) {
    console.log("📧 Handling conversation change:", data);
    
    try {
      const email = this.extractEmailFromData(data);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Extracted email from conversation:", email);
        this.performAutoSearch(email);
      } else {
        console.log("❌ No valid email found in conversation data");
      }
    } catch (error) {
      console.error("❌ Error handling conversation change:", error);
    }
  }

  handleEmailFocus(data) {
    console.log("📧 Handling email focus:", data);
    
    try {
      const email = this.extractEmailFromData(data);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Extracted email from email focus:", email);
        this.performAutoSearch(email);
      } else {
        console.log("❌ No valid email found in email focus data");
      }
    } catch (error) {
      console.error("❌ Error handling email focus:", error);
    }
  }

  getVersion() {
    // Default shown until manifest loads; will be replaced by GH-<sha>
    return 'vJS3.50';
  }

  async loadVersionFromManifest() {
    // Version is now handled directly in updateHeaderWithVersion()
    // No need to fetch external version.json file
    return;
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
    
    // console.log("🔍 === MISSIVE ENVIRONMENT DETECTION ===");
    // console.log("hasMissiveAPI:", hasMissiveAPI);
    // console.log("hasMissiveScript:", hasMissiveScript);
    // console.log("isInIframe:", isInIframe);
    // console.log("urlContainsMissive:", urlContainsMissive);
    // console.log("hasMissiveUI:", hasMissiveUI);
    // console.log("Final result:", isMissive);
    // console.log("🔍 === DETECTION END ===");
    
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
      // Try to sync version with deployed manifest so local and hosted match
      this.loadVersionFromManifest();
      
      // Initialize Missive API integration
      if (this.isMissiveEnvironment) {
        await this.initializeMissiveAPI();
      }
      
      // Always attempt URL-driven auto-search (works in web and Missive)
      this.maybeAutoSearchFromUrl();
      this.setupCleanup(); // Setup proper cleanup
      // Initialize dynamic preloading for Team Inboxes - DISABLED in vJS3.35
      // await this.initializePreloading();
      this.setStatus("Ready"); // Set Ready immediately
      // Only test connection if not in Missive environment
      if (!this.isMissiveEnvironment) {
        await this.testConnection();
      }
      console.log("Application initialized successfully");
      
      // Always clear loading state after initialization
      this.hideLoading();
      
      // Add debug methods to global scope for testing
      window.MissWooDebug = {
        logStatus: () => this.logPreloadingStatus(),
        triggerPreload: () => this.triggerPreloading(),
        getPreloadedEmails: () => Array.from(this.preloadedConversations.keys()),
        getSeenConversations: () => Array.from(this.seenConversationIds),
        clearPreloaded: () => { this.preloadedConversations.clear(); console.log("Cleared preloaded data"); }
      };
      // console.log("🔧 Debug methods available: window.MissWooDebug");
      
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

  maybeAutoSearchFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      if (emailParam) {
        const email = emailParam.trim();
        this.setStatus(`URL param email detected → ${email}`);
        if (this.isValidEmailForSearch(email)) {
          this.performAutoSearch(email);
        } else {
          this.setStatus(`Invalid email in URL: ${email}`, 'error');
        }
      }
    } catch (err) {
      console.log('Failed parsing URL params:', err);
    }
  }

  async bindEvents() {
    console.log("Binding events...");
    try {
      const searchBtnA = document.getElementById("searchBtn");
      const searchInputA = document.getElementById("orderSearch");
      const searchBtnB = document.getElementById("searchButton");
      const searchInputB = document.getElementById("searchInput");

      // Bind classic UI
      if (searchBtnA) {
        searchBtnA.addEventListener("click", () => this.handleSearch());
      }
      if (searchInputA) {
        searchInputA.addEventListener("keypress", (e) => {
          if (e.key === "Enter") this.handleSearch();
        });
      }

      // Bind dynamic UI
      if (searchBtnB) {
        searchBtnB.addEventListener("click", () => this.handleSearch());
      }
      if (searchInputB) {
        searchInputB.addEventListener("keypress", (e) => {
          if (e.key === "Enter") this.handleSearch();
        });
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
    const inputA = document.getElementById("orderSearch");
    const inputB = document.getElementById("searchInput");
    const raw = (inputA?.value ?? inputB?.value ?? '').trim();
    const searchTerm = raw;

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
            
            // Display the results after search completes
            await this.displayOrdersList();
        } catch (error) {
      console.error("Search error:", error);
      this.showError(`Search failed: ${error.message}`);
    } finally {
      // Reset search in progress when search completes
      this.searchInProgress = false;
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
    const startTime = performance.now();
    console.log("Searching orders for email:", email);
    
    // Clear previous data if this is a new email search
    if (this.lastSearchedEmail !== email) {
      this.clearCurrentEmailData();
      this.lastSearchedEmail = email;
    }
    
    // Check emailCache first (unified caching)
    if (this.emailCache && this.emailCache.has(email) && this.isCacheValid(email, 'emailCache')) {
      console.log("Using cached results for:", email);
      const cachedOrders = this.emailCache.get(email);
      console.log("Cached orders:", cachedOrders);
      console.log("Cached orders type:", typeof cachedOrders);
      console.log("Cached orders is array:", Array.isArray(cachedOrders));
      console.log("Cached orders length:", Array.isArray(cachedOrders) ? cachedOrders.length : 'not an array');
      this.allOrders = Array.isArray(cachedOrders) ? cachedOrders : [];
      console.log("this.allOrders after cache:", this.allOrders);
      console.log("this.allOrders length:", this.allOrders.length);
      // Don't call displayOrdersList here - let the caller handle it
      console.log(`Cache hit - Search completed in ${(performance.now() - startTime).toFixed(2)}ms`);
      return;
    }
    
    try {
      // Search WooCommerce orders only
      const orderResults = await this.searchWooCommerceOrders(email);
      
      // Ensure orderResults is an array
      if (!Array.isArray(orderResults)) {
        console.error("searchWooCommerceOrders returned non-array:", orderResults);
        this.allOrders = [];
        return;
      }
      
      // Set results
      this.allOrders = orderResults;
      // Don't call displayOrdersList here - let the caller handle it
      
      // Cache the results in emailCache (unified caching)
      if (this.emailCache) {
        this.emailCache.set(email, [...orderResults]);
        this.setCacheExpiry(email, 'emailCache');
        console.log(`Cached ${orderResults.length} orders for ${email} in emailCache`);
      }
      
      console.log(`Search completed in ${(performance.now() - startTime).toFixed(2)}ms`);
      this.logPerformanceStats();
    } catch (error) {
      console.error("Search error:", error);
      this.showError(`Failed to search: ${error.message}`);
    } finally {
      // Reset search in progress when search completes
      this.searchInProgress = false;
    }
  }

  async searchWooCommerceOrders(email) {
    let allOrders = [];
    let page = 1;
    const maxPages = 3; // Reduced from 5 to 3 pages for faster search

    try {
      // Fetch first page immediately to show results faster
      console.log(`Searching WooCommerce orders page ${page}...`);
      const firstPageUrl = this.getAuthenticatedUrl('/orders', {
        search: email,
        per_page: 100,
        page: page
      });
      
      const firstPageData = await this.makeRequest(firstPageUrl);
      
      // Ensure firstPageData is an array
      if (!Array.isArray(firstPageData)) {
        console.error("API returned non-array data:", firstPageData);
        return [];
      }
      
      console.log(`Found ${firstPageData.length} orders on page ${page}`);
      
      if (firstPageData.length > 0) {
        allOrders = allOrders.concat(firstPageData);
        
        // Continue searching if needed
        page++;
        while (page <= maxPages) {
          console.log(`Searching WooCommerce orders page ${page}...`);
          const url = this.getAuthenticatedUrl('/orders', {
            search: email,
            per_page: 100,
            page: page
          });
          
          const data = await this.makeRequest(url);
          
          // Ensure data is an array
          if (!Array.isArray(data)) {
            console.error("API returned non-array data on page", page, ":", data);
            break;
          }
          
          console.log(`Found ${data.length} orders on page ${page}`);
          
          if (data.length === 0) {
            break; // No more orders to fetch
          }
          
          allOrders = allOrders.concat(data);
          page++;
        }
      }

      console.log(`Total WooCommerce orders found: ${allOrders.length}`);

      // Filter for exact email matches and get the latest 5
      const matchingOrders = this.filterOrdersByEmail(allOrders, email);
      console.log(`Total matching WooCommerce orders (latest 5): ${matchingOrders.length}`);

      // Process order details
      const processedOrders = await this.processOrdersWithDetails(matchingOrders, email);
      return Array.isArray(processedOrders) ? processedOrders : [];
      
    } catch (error) {
      console.error("Error in searchWooCommerceOrders:", error);
      return [];
    }
  }

  async searchContactFormSubmissions(email) {
    try {
      console.log(`🔍 Searching contact form submissions for: ${email}`);
      
      // Search for contact form submissions in WordPress
      const submissionsUrl = this.getAuthenticatedUrl('/contact-form-submissions', {
        search: email,
        per_page: 50
      });
      
      const response = await this.makeRequest(submissionsUrl);
      
      if (Array.isArray(response)) {
        console.log(`Found ${response.length} contact form submissions for ${email}`);
        return response.map(submission => ({
          ...submission,
          type: 'contact_form',
          source: 'Contact Form'
        }));
      }
      
      return [];
    } catch (error) {
      console.log(`No contact form submissions found for ${email}:`, error.message);
      return [];
    }
  }

  filterOrdersByEmail(orders, email) {
    return orders
      .filter(order => {
        const orderEmail = order.billing?.email || '';
        const matches = orderEmail.toLowerCase() === email.toLowerCase();
        console.log(`Checking order ${order.number}: ${orderEmail} against ${email}: ${matches}`);
        return matches;
      })
      .slice(0, 5); // Get latest 5 orders
  }

  async processOrdersWithDetails(orders, email) {
    // Get notes for all orders in parallel
    const orderPromises = orders.map(async (order) => {
      try {
        const notesUrl = this.getAuthenticatedUrl(`/orders/${order.id}/notes`);
        const notes = await this.makeRequest(notesUrl);
        order.notes = notes;
        return order;
      } catch (error) {
        console.error(`Failed to get notes for order ${order.id}:`, error);
        order.notes = [];
        return order;
      }
    });

    const processedOrders = await Promise.all(orderPromises);
    this.allOrders = processedOrders;
    
    // Cache the results with expiration (unified caching)
    if (this.emailCache) {
      this.emailCache.set(email, processedOrders);
      this.setCacheExpiry(email, 'emailCache');
      console.log(`Cached ${processedOrders.length} processed orders for ${email} in emailCache`);
    }
    
    // Return the processed orders
    return processedOrders;
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
    
    // Request deduplication - if same request is pending, wait for it
    const requestKey = `${url}-${JSON.stringify(options)}`;
    if (this.pendingRequests.has(requestKey)) {
      console.log("Request already pending, waiting for result:", requestKey);
      return this.requestQueue.get(requestKey);
    }
    
    // Add cache-busting parameter for Missive environment
    const separator = url.includes('?') ? '&' : '?';
    const cacheBustedUrl = this.isMissiveEnvironment 
      ? `${url}${separator}_cb=${this.cacheBuster}`
      : url;
    
    // Create promise for this request
    const requestPromise = (async () => {
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
      } finally {
        // Clean up request tracking
        this.pendingRequests.delete(requestKey);
        this.requestQueue.delete(requestKey);
      }
    })();
    
    // Track this request
    this.pendingRequests.add(requestKey);
    this.requestQueue.set(requestKey, requestPromise);
    
    return requestPromise;
  }

  async displayOrdersList() {
    // Prevent multiple simultaneous calls
    if (this._displayInProgress) {
      console.log("⏳ Display already in progress, skipping...");
      // console.log("DEBUG: displayOrdersList skipped due to _displayInProgress.");
      return;
    }
    this._displayInProgress = true;
    
    // console.log(`DEBUG: displayOrdersList called. _displayInProgress: ${this._displayInProgress}, allOrders.length: ${this.allOrders.length}`);
    
    try {
      // Ensure allOrders is always an array
      if (!Array.isArray(this.allOrders)) {
        this.allOrders = [];
      }
      
      if (this.allOrders.length === 0) {
        this.hideLoading();
        // console.log("DEBUG: displayOrdersList - No orders in allOrders, setting 'No orders found'.");
        this.setStatus("No orders found");
        return;
      }
  
      // Set correct status when orders are found
      this.setStatus(`Found ${this.allOrders.length} order(s)`);
      // console.log(`DEBUG: displayOrdersList - Setting status to 'Found ${this.allOrders.length} order(s)'.`);

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
    
    // Create body with basic info first
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
      
      // Serial number (show loading initially)
      const serialCell = document.createElement("td");
      serialCell.textContent = "Loading...";
      serialCell.id = `serial-${order.id}`;
      row.appendChild(serialCell);
      
      // Tracking (show loading initially)
      const trackingCell = document.createElement("td");
      trackingCell.textContent = "Loading...";
      trackingCell.id = `tracking-${order.id}`;
      row.appendChild(trackingCell);
      
      tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    
    // Clear and populate results with basic info
    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(customerInfoSection);
    resultsContainer.appendChild(table);
    
    // Hide loading after basic info is displayed
    this.hideLoading();
    
    // Then enhance with serial numbers and tracking info in parallel
    const enhancementPromises = this.allOrders.map(async (order) => {
      // Get serial number
      const serialNumber = await this.getSerialNumber(order);
      const serialCell = document.getElementById(`serial-${order.id}`);
      if (serialCell) serialCell.textContent = serialNumber;
      
      // Get tracking info
      const trackingInfo = this.getTrackingInfo(order);
      const trackingCell = document.getElementById(`tracking-${order.id}`);
      if (trackingCell) {
        if (trackingInfo) {
          const trackingLink = document.createElement("a");
          trackingLink.href = trackingInfo.url;
          trackingLink.target = "_blank";
          trackingLink.textContent = trackingInfo.number;
          trackingCell.innerHTML = "";
          trackingCell.appendChild(trackingLink);
        } else {
          trackingCell.textContent = "N/A";
        }
      }
    });
    
    await Promise.all(enhancementPromises);
    
    // Start background processing for additional data
    this.startBackgroundProcessing();
    } finally {
      this._displayInProgress = false;
      // console.log("DEBUG: displayOrdersList finished. _displayInProgress set to false.");
    }
  }

  startBackgroundProcessing() {
    // Process additional data in background without blocking UI
    this.backgroundTasks.push(async () => {
      try {
        // Preload related data for better UX
        await this.preloadRelatedData();
      } catch (error) {
        console.log('Background processing error:', error);
      }
    });
    
    // Process background tasks
    this.processBackgroundTasks();
  }

  async processBackgroundTasks() {
    if (this.backgroundTasks.length === 0) return;
    
    const task = this.backgroundTasks.shift();
    if (task) {
      try {
        await task();
        } catch (error) {
        console.log('Background task error:', error);
      }
    }
    
    // Process next task after a short delay
    if (this.backgroundTasks.length > 0) {
      setTimeout(() => this.processBackgroundTasks(), 100);
    }
  }

  async preloadRelatedData() {
    // Preload data for orders that might be accessed next
    if (this.allOrders.length > 0) {
      const firstOrder = this.allOrders[0];
      const customerEmail = firstOrder.billing?.email;
      
      if (customerEmail && !this.orderCache.has(customerEmail)) {
        console.log('Preloading related order data for:', customerEmail);
        // Preload in background without blocking UI or affecting status
        setTimeout(async () => {
          try {
            // Use a silent version that doesn't set status messages
            await this.searchOrdersByEmailSilent(customerEmail);
          } catch (error) {
            console.log('Preload failed:', error);
          }
        }, 1000);
      }
    }
  }

  // Silent version of searchOrdersByEmail that doesn't set status messages
  async searchOrdersByEmailSilent(email) {
    try {
      console.log(`Silent search for: ${email}`);
      
      // Check cache first
      if (this.emailCache && this.emailCache.has(email) && this.isCacheValid(email, 'emailCache')) {
        const cachedOrders = this.emailCache.get(email);
        if (Array.isArray(cachedOrders)) {
          console.log(`Silent cache hit for ${email}: ${cachedOrders.length} orders`);
          return cachedOrders;
        }
      }
      
      // Perform actual search without setting status
      const orderResults = await this.searchWooCommerceOrders(email);
      
      if (Array.isArray(orderResults)) {
        // Process and cache results silently
        const processedOrders = await this.processOrdersWithDetails(orderResults, email);
        
        // Cache the results
        if (this.emailCache) {
          this.emailCache.set(email, processedOrders);
          this.setCacheExpiry(email, 'emailCache');
          console.log(`Silent cached ${processedOrders.length} processed orders for ${email} in emailCache`);
        }
        
        return processedOrders;
      }
      
      return [];
    } catch (error) {
      console.error(`Silent search failed for ${email}:`, error);
      return [];
    }
  }

  getPerformanceStats() {
    return {
      cacheHits: {
        orders: this.orderCache ? this.orderCache.size : 0,
        katana: this.katanaOrderCache ? this.katanaOrderCache.size : 0,
        serials: this.serialNumberCache ? this.serialNumberCache.size : 0
      },
      pendingRequests: this.pendingRequests.size,
      backgroundTasks: this.backgroundTasks.length,
      cacheExpiryEntries: this.cacheExpiry.size
    };
  }

  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    console.log('📊 Performance Stats:', stats);
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
      
      // Check cache first with expiration
      if (this.serialNumberCache && this.serialNumberCache.has(order.number) && this.isCacheValid(order.number, 'serialCache')) {
        console.log(`Using cached serial numbers for order #${order.number}`);
        return this.serialNumberCache.get(order.number);
      }
      
      // Get the Katana sales order that matches this WooCommerce order
      const katanaOrder = await this.getKatanaOrder(order.number);
      if (!katanaOrder) {
        console.log(`No Katana order found for WooCommerce order #${order.number}`);
        this.serialNumberCache.set(order.number, "N/A");
        return "N/A";
      }

      console.log(`Found Katana order ID: ${katanaOrder.id} for WooCommerce order #${order.number}`);

      // Get serial numbers from all sales order rows
      const serialNumbers = await this.getAllSerialNumbersFromOrder(katanaOrder, order.number);
      
      if (serialNumbers && serialNumbers.length > 0) {
        console.log(`Found ${serialNumbers.length} serial number(s) for order #${order.number}:`, serialNumbers);
        const result = serialNumbers.join(', ');
        this.serialNumberCache.set(order.number, result);
        this.setCacheExpiry(order.number, 'serialCache');
        return result;
      } else {
        console.log(`No serial numbers found for order #${order.number}`);
        this.serialNumberCache.set(order.number, "N/A");
        return "N/A";
      }
        } catch (error) {
      console.error('Error getting serial number:', error);
      this.serialNumberCache.set(order.number, "N/A");
      return "N/A";
    }
  }

  async getAllSerialNumbersFromOrder(katanaOrder, orderNumber) {
    try {
      console.log(`Looking for serial numbers in Katana order details`);
      
      // Check if the order has sales_order_rows
      if (katanaOrder.sales_order_rows && Array.isArray(katanaOrder.sales_order_rows)) {
        console.log(`Found sales_order_rows array with ${katanaOrder.sales_order_rows.length} items`);
        
        // Fetch serial numbers for all rows in parallel
        const serialNumberPromises = katanaOrder.sales_order_rows
          .filter(row => row.id)
          .map(async (row, index) => {
            console.log(`Examining sales order row ${index + 1}:`, row);
            console.log(`Fetching serial numbers for row ID: ${row.id}`);
            const serialNumbers = await this.getSerialNumbersForRow(row.id);
            if (serialNumbers && serialNumbers.length > 0) {
              console.log(`Found ${serialNumbers.length} serial number(s) for row ID ${row.id}:`, serialNumbers);
            }
            return serialNumbers || [];
          });
        
        const allSerialNumberArrays = await Promise.all(serialNumberPromises);
        const allSerialNumbers = allSerialNumberArrays.flat();
        
        console.log(`Total serial numbers found: ${allSerialNumbers.length}`);
        return allSerialNumbers;
      } else {
        console.log(`No sales_order_rows found in order`);
        return [];
      }
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
      
      // Check cache first with expiration
      if (this.katanaOrderCache && this.katanaOrderCache.has(wooOrderNumber) && this.isCacheValid(wooOrderNumber, 'katanaCache')) {
        console.log(`Using cached Katana order for #${wooOrderNumber}`);
        return this.katanaOrderCache.get(wooOrderNumber);
      }
      
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
          this.katanaOrderCache.set(wooOrderNumber, fullOrder);
          this.setCacheExpiry(wooOrderNumber, 'katanaCache');
          return fullOrder;
        } else {
          console.log(`Could not get full order details, returning basic order`);
          this.katanaOrderCache.set(wooOrderNumber, katanaOrder);
          return katanaOrder;
        }
      } else {
        console.log(`No Katana order found for WooCommerce order #${wooOrderNumber}`);
        this.katanaOrderCache.set(wooOrderNumber, null);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching Katana order for #${wooOrderNumber}:`, error);
      this.katanaOrderCache.set(wooOrderNumber, null);
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
    // Loading animation removed - only status messages are used now
    this.setStatus('Loading...');
  }

  hideLoading() {
    // Loading animation removed - status messages handle this now
  }

  showError(message) {
    const errorElement = document.getElementById("error");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("hidden");
    }
    this.setStatus(message, 'error');
  }

  setStatus(message, type = 'info') {
    // Try both possible status element IDs
    let statusElement = document.getElementById('status');
    if (!statusElement) {
      statusElement = document.getElementById('statusText');
    }
    
    if (statusElement) {
      statusElement.textContent = message;
      if (statusElement.className) {
        statusElement.className = `status ${type}`;
      }
      
      // Show the status message container if it exists
      const statusMessageContainer = document.getElementById('statusMessage');
      if (statusMessageContainer) {
        statusMessageContainer.style.display = 'block';
      }
    }
    console.log(`Status: ${message}`);
  }

  // Legacy Missive initialization removed - now handled by JS API integration

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
    // console.log("🔧 === UI UPDATE DEBUG ===");
    console.log("Environment detection:", this.isMissiveEnvironment);
    console.log("Auto-search enabled:", this.autoSearchEnabled);
    
    // Update header with version number
    this.updateHeaderWithVersion();
    
    const searchSection = document.querySelector('.search-section');
    console.log("Search section found:", !!searchSection);
    
    if (searchSection) {
      console.log("Search section element:", searchSection);
      
      if (this.isMissiveEnvironment) {
        console.log("🔧 Setting up Missive UI...");
        
        // Clear existing content
        searchSection.innerHTML = '';
        
        // Create simple Missive UI without diagnostic tools
        searchSection.innerHTML = `
          <div class="missive-ui">
            <h3>🎯 Missive Auto-Search</h3>
            <p>Click on emails to automatically search for orders</p>
            
            <div class="search-controls">
              <input type="text" id="searchInput" placeholder="Manual search..." class="form-control">
              <button id="searchButton" class="btn btn-primary">Search</button>
                </div>
            
            <div id="statusMessage" class="status-message" style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px; display: none;">
              <strong>Status:</strong> <span id="statusText">Ready</span>
                </div>
            <pre id="statusDetails" style="display:none; margin-top:6px; font-size: 12px; color:#666; white-space: pre-wrap;"></pre>
            </div>
        `;
        
        // Bind simple events
        this.bindSimpleEvents();
        
        console.log("✅ Missive UI updated successfully");
      } else {
        console.log("🔧 Setting up Web UI...");
        
        // Clear existing content
        searchSection.innerHTML = '';
        
        // Create web-specific UI
        searchSection.innerHTML = `
          <div class="web-ui">
            <h3>🌐 Web Mode</h3>
            <p>Manual search mode - enter email or order number</p>
            
            <div class="search-controls">
              <input type="text" id="searchInput" placeholder="Enter email or order number..." class="form-control">
              <button id="searchButton" class="btn btn-primary">Search</button>
            </div>
            <pre id="statusDetails" style="display:none; margin-top:6px; font-size: 12px; color:#666; white-space: pre-wrap;"></pre>
            </div>
        `;
        
        // Bind web events
        this.bindWebEvents();
        
        console.log("✅ Web UI updated successfully");
      }
    }
    
    // console.log("🔧 === UI UPDATE DEBUG END ===");
  }

  updateHeaderWithVersion() {
    const versionBadge = document.querySelector('.version-badge');
    if (versionBadge) {
      // Use JS API version numbering
      const version = this.isMissiveEnvironment ? 'vJS3.50' : 'vJS3.50 DEV';
      versionBadge.textContent = version;
      console.log(`Version updated to: ${version}`);
    }
  }

  // Legacy Missive event listeners removed - now handled by JS API integration

  // Legacy fallback auto-search methods removed - now handled by JS API integration

  // Legacy tryGetCurrentEmail method removed - now handled by JS API integration

  // Legacy Missive event handlers removed - now handled by JS API integration

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
    console.log("🔍 Data type:", typeof data);
    console.log("🔍 Data keys:", data ? Object.keys(data) : 'null/undefined');
    
    if (!data) {
      console.log("❌ No data provided");
      return null;
    }

    // Handle arrays - if we receive an array of IDs, we can't extract email directly
    if (Array.isArray(data)) {
      // console.log("🔍 Received array of data, cannot extract email directly from array");
      return null;
    }

    // console.log("🔍 Data keys:", Object.keys(data || {}));
    if (data && typeof data === 'object') {
      // console.log("🔍 Data structure:", JSON.stringify(data, null, 2));
    }
    
    if (!data) {
      // console.log("❌ No data provided");
      return null;
    }

    // Contact-centric shapes
    if (data.contact) {
      const c = data.contact;
      if (Array.isArray(c.emails) && c.emails.length > 0) {
        const e = c.emails.find((x) => typeof x === 'string' ? this.isValidEmailForSearch(x) : this.isValidEmailForSearch(x?.email));
        if (typeof e === 'string') return e;
        if (e && e.email) return e.email;
      }
      if (c.email && this.isValidEmailForSearch(c.email)) return c.email;
    }

    // Try different data structures
    if (data.email) {
      console.log("✅ Found email in data.email:", data.email);
      if (this.isValidEmailForSearch(data.email)) {
        return data.email;
      } else {
        console.log("❌ Email in data.email is not valid for search:", data.email);
      }
    }
    
    if (data.recipient && (data.recipient.email || data.recipient.handle || data.recipient.address)) {
      console.log("✅ Found email in data.recipient.email:", data.recipient.email);
      const candidate = data.recipient.email || data.recipient.handle || data.recipient.address;
      if (this.isValidEmailForSearch(candidate)) return candidate;
    }
    
    if (data.thread && data.thread.participants) {
      const emailFromParticipants = this.extractEmailFromParticipants(data.thread.participants);
      if (emailFromParticipants) return emailFromParticipants;
    }
    
    if (data.participants) {
      const emailFromParticipants = this.extractEmailFromParticipants(data.participants);
      if (emailFromParticipants) return emailFromParticipants;
    }
    
    // Check email_addresses array (Missive conversation format)
    if (Array.isArray(data.email_addresses) && data.email_addresses.length > 0) {
      console.log("✅ Found email_addresses array:", data.email_addresses);
      // Filter out @quikrstuff.com emails and get the first external email
      const externalEmail = data.email_addresses.find(emailObj => {
        const address = emailObj.address || emailObj.email;
        return address && this.isValidEmailForSearch(address);
      });
      if (externalEmail) {
        const email = externalEmail.address || externalEmail.email;
        console.log("✅ Found external email in email_addresses:", email);
        return email;
      }
    }

    // Messages shape (conversation.messages or data.message)
    if (Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        const from = msg.from?.email || msg.from?.handle || msg.from?.address;
        if (from && this.isValidEmailForSearch(from)) return from;
        const toList = msg.to || [];
        for (const t of toList) {
          const addr = t.email || t.handle || t.address;
          if (addr && this.isValidEmailForSearch(addr)) return addr;
        }
      }
    }
    if (data.message) {
      const from = data.message.from?.email || data.message.from?.handle || data.message.from?.address;
      if (from && this.isValidEmailForSearch(from)) return from;
      const toList = data.message.to || [];
      for (const t of toList) {
        const addr = t.email || t.handle || t.address;
        if (addr && this.isValidEmailForSearch(addr)) return addr;
      }
    }
    
    // Try to extract from text content (email body)
    if (data.text) {
      const email = this.extractEmailFromString(data.text);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Found email in data.text (body):", email);
        return email;
      }
    }
    
    if (data.content) {
      const email = this.extractEmailFromString(data.content);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Found email in data.content (body):", email);
        return email;
      }
    }
    
    if (data.body) {
      const email = this.extractEmailFromString(data.body);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Found email in data.body:", email);
        return email;
      }
    }
    
    if (data.html) {
      const email = this.extractEmailFromString(data.html);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Found email in data.html:", email);
        return email;
      }
    }
    
    if (data.subject) {
      const email = this.extractEmailFromString(data.subject);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Found email in data.subject:", email);
        return email;
      }
    }
    
    // Try to extract from any string properties (including message content)
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('@')) {
        const email = this.extractEmailFromString(value);
        if (email && this.isValidEmailForSearch(email)) {
          console.log(`✅ Found email in data.${key}:`, email);
          return email;
        }
      }
    }
    
    // Check messages array for body content
    if (Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        // Check message body content
        if (msg.text) {
          const email = this.extractEmailFromString(msg.text);
          if (email && this.isValidEmailForSearch(email)) {
            console.log("✅ Found email in message.text:", email);
            return email;
          }
        }
        if (msg.content) {
          const email = this.extractEmailFromString(msg.content);
          if (email && this.isValidEmailForSearch(email)) {
            console.log("✅ Found email in message.content:", email);
            return email;
          }
        }
        if (msg.body) {
          const email = this.extractEmailFromString(msg.body);
          if (email && this.isValidEmailForSearch(email)) {
            console.log("✅ Found email in message.body:", email);
            return email;
          }
        }
        if (msg.html) {
          const email = this.extractEmailFromString(msg.html);
          if (email && this.isValidEmailForSearch(email)) {
            console.log("✅ Found email in message.html:", email);
            return email;
          }
        }
      }
    }

    // Final fallback: search through all string properties for email patterns
    console.log("🔍 Final fallback: searching all string properties for emails...");
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('@')) {
        console.log(`🔍 Found string with @ in data.${key}:`, value);
        const email = this.extractEmailFromString(value);
        if (email && this.isValidEmailForSearch(email)) {
          console.log(`✅ Found valid email in data.${key}:`, email);
          return email;
        }
      }
    }
    
    console.log("❌ No email found in data structure");
    return null;
  }

  extractEmailFromParticipants(participants) {
    if (!Array.isArray(participants)) return null;
    // Prefer external recipients/senders over internal
    const preferredOrder = [
      (p) => p.role === 'to',
      (p) => p.role === 'from',
      () => true,
    ];
    for (const predicate of preferredOrder) {
      const candidate = participants.find(predicate);
      if (!candidate) continue;
      const emailLike = candidate.email || candidate.handle || candidate.address || candidate?.contact?.email;
      if (emailLike && this.isValidEmailForSearch(emailLike)) return emailLike;
      if (Array.isArray(candidate?.contact?.emails)) {
        const e = candidate.contact.emails.find((x) => this.isValidEmailForSearch(typeof x === 'string' ? x : x?.email));
        if (typeof e === 'string' && this.isValidEmailForSearch(e)) return e;
        if (e?.email && this.isValidEmailForSearch(e.email)) return e.email;
      }
    }
    // Try all participants
    for (const p of participants) {
      const emailLike = p.email || p.handle || p.address || p?.contact?.email;
      if (emailLike && this.isValidEmailForSearch(emailLike)) return emailLike;
    }
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
    
    // More comprehensive email regex that handles various formats
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex);
    
    if (!matches || matches.length === 0) return null;
    
    // Return the first valid email (filter out @quikrstuff.com)
    for (const match of matches) {
      if (this.isValidEmailForSearch(match)) {
        return match;
      }
    }
    
    return null;
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

  // Dynamic preloading system for Visible Conversations
  async preloadVisibleConversations() {
    if (this.preloadingInProgress) {
      console.log("⏳ Preloading already in progress, skipping...");
      return;
    }
    
    this.preloadingInProgress = true;
    
    // Add timeout to prevent getting stuck
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Preloading timeout")), 10000); // 10 second timeout
    });
    
    try {
      // Race between preloading and timeout
      await Promise.race([
        (async () => {
          console.log("🔄 Starting visible conversation preloading...");
          
          // Only set status if no search is in progress
          if (!this.searchInProgress) {
            this.setStatus("Preloading visible emails...");
          }
          
          const conversations = await this.fetchVisibleConversations();
          
          if (!conversations || conversations.length === 0) {
            // console.log("❌ No conversations found for preloading");
            // Only set Ready status if no search is in progress
            if (!this.searchInProgress) {
              this.setStatus("Ready");
            }
            return;
          }
          
          // Update visible conversation tracking
          this.updateVisibleConversations(conversations);
          
          // Extract and preload emails
          const emailsToPreload = this.extractEmailsFromConversations(conversations);
          console.log(`📧 Found ${emailsToPreload.length} emails to preload`);
          
          if (emailsToPreload.length === 0) {
            // console.log("❌ No valid emails found in conversations");
            // Only set Ready status if no search is in progress
            if (!this.searchInProgress) {
              this.setStatus("Ready");
            }
            return;
          }
          
          // Preload data for each email
          await this.preloadEmailsData(emailsToPreload);
          
          // Clean up archived conversations
          this.cleanupArchivedConversations();
          
          console.log(`✅ Visible conversation preloading complete: ${emailsToPreload.length} emails preloaded`);
          // Only set Ready status if no search is in progress
          if (!this.searchInProgress) {
            this.setStatus("Ready");
          }
        })(),
        timeoutPromise
      ]);
      
    } catch (error) {
      console.error("❌ Visible conversation preloading failed:", error);
      // Only set Ready status if no search is in progress
      if (!this.searchInProgress) {
        this.setStatus("Ready");
      }
    } finally {
      this.preloadingInProgress = false;
    }
  }

  async fetchVisibleConversations() {
    try {
      // Try to get current conversation first
      let conversations = [];
      
      if (Missive.getCurrentConversation) {
        try {
          const currentConv = await Missive.getCurrentConversation();
          if (currentConv && currentConv.id) {
            conversations.push(currentConv);
            console.log(`📧 Got current conversation: ${currentConv.id}`);
          }
        } catch (error) {
          // console.log("❌ Failed to get current conversation:", error);
        }
      }
      
      // Try to fetch conversations using the options approach
      if (Missive.fetchConversations && conversations.length === 0) {
        try {
          console.log("📧 Trying fetchConversations with options...");
          const fetchedConversations = await Missive.fetchConversations([
            this.maxPreloadedConversations,
            'oldest'
          ]);
          
          if (Array.isArray(fetchedConversations)) {
            conversations = fetchedConversations;
            console.log(`📧 Fetched ${conversations.length} conversations with options`);
          }
        } catch (error) {
          // console.log("❌ fetchConversations with options failed:", error);
        }
      }
      
      // If we still don't have conversations, try a different approach
      if (conversations.length === 0) {
        console.log("📧 No conversations found, preloading will be triggered by events");
        return [];
      }
      
      console.log(`📧 Total conversations for preloading: ${conversations.length}`);
      return conversations;
    } catch (error) {
      console.error("❌ Failed to fetch Team Inbox conversations:", error);
      return [];
    }
  }

  updateVisibleConversations(conversations) {
    this.visibleConversationIds.clear();
    
    for (const conversation of conversations) {
      if (conversation.id) {
        this.visibleConversationIds.add(conversation.id);
      }
    }
    
    console.log(`📧 Updated visible conversations: ${this.visibleConversationIds.size} conversations`);
  }

  extractEmailsFromConversations(conversations) {
    const emails = new Set();
    
    for (const conversation of conversations) {
      const email = this.extractEmailFromData(conversation);
      if (email && this.isValidEmailForSearch(email)) {
        emails.add(email);
      }
    }
    
    return Array.from(emails);
  }

  async preloadEmailsData(emails) {
    const preloadPromises = emails.map(async (email) => {
      try {
        // Check if already cached and still valid
        if (this.emailCache && this.emailCache.has(email) && this.isCacheValid(email, 'emailCache')) {
          console.log(`📧 Skipping ${email} - already cached and valid`);
          return;
        }
        
        console.log(`📧 Preloading data for: ${email}`);
        
        // Store current orders to restore after preloading
        const currentOrders = [...this.allOrders];
        
        // Preload order data (this will populate emailCache)
        await this.searchOrdersByEmail(email);
        
        // Also store in preloadedConversations for tracking
        if (this.allOrders.length > 0) {
          this.preloadedConversations.set(email, {
            orders: [...this.allOrders],
            timestamp: Date.now()
          });
          console.log(`✅ Preloaded ${this.allOrders.length} orders for ${email} (cached in emailCache)`);
        }
        
        // Restore current orders
        this.allOrders = currentOrders;
        
      } catch (error) {
        console.error(`❌ Failed to preload data for ${email}:`, error);
      }
    });
    
    await Promise.all(preloadPromises);
  }

  isPreloadedDataValid(email) {
    // Check unified emailCache instead of separate preloadedConversations
    if (this.emailCache && this.emailCache.has(email) && this.isCacheValid(email, 'emailCache')) {
      return true;
    }
    
    // Fallback to preloadedConversations for backward compatibility
    const preloadedData = this.preloadedConversations.get(email);
    if (!preloadedData) return false;
    
    const now = Date.now();
    const age = now - preloadedData.timestamp;
    const maxAge = this.cacheConfig.preloadedCache;
    
    return age < maxAge;
  }

  cleanupArchivedConversations() {
    const emailsToRemove = [];
    
    for (const [email, data] of this.preloadedConversations) {
      // Check if email is still from a visible conversation
      const isStillVisible = this.isEmailFromVisibleConversation(email);
      
      if (!isStillVisible) {
        emailsToRemove.push(email);
        console.log(`🗑️ Marking ${email} for cleanup - no longer visible`);
      }
    }
    
    // Remove archived conversation data
    for (const email of emailsToRemove) {
      this.preloadedConversations.delete(email);
      this.emailCache.delete(email);
    }
    
    if (emailsToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${emailsToRemove.length} archived conversations`);
    }
  }

  isEmailFromVisibleConversation(email) {
    // This is a simplified check - in a real implementation,
    // we'd need to track which email belongs to which conversation
    // For now, we'll keep preloaded data unless explicitly cleaned up
    return true;
  }

  // Enhanced preloading that uses preloaded data when available
  async performAutoSearch(email) {
    if (!email || !this.isValidEmailForSearch(email)) {
      // console.log("❌ Invalid email for search:", email);
      return;
    }

    // Check if we're already searching this email
    if (this.searchInProgress && this.activeSearches.has(email)) {
      console.log(`⏳ Already searching for ${email}, skipping`);
      return;
    }

    // Always clear the display first when switching emails
    this.clearCurrentEmailData();

    // Check for cached/preloaded data first (immediate)
    if (this.emailCache && this.emailCache.has(email) && this.isCacheValid(email, 'emailCache')) {
      const cachedOrders = this.emailCache.get(email);
      if (Array.isArray(cachedOrders) && cachedOrders.length > 0) {
        console.log(`✅ Found cached data for ${email}: ${cachedOrders.length} orders`);
        this.allOrders = [...cachedOrders];
        // console.log(`DEBUG: performAutoSearch - Calling displayOrdersList for ${email}. allOrders.length: ${this.allOrders.length}`);
        this.displayOrdersList();
        // Ensure correct status is set after displayOrdersList
        this.setStatus(`Found ${this.allOrders.length} order(s)`);
        return;
      }
    }

    // Check preloaded data
    if (this.isPreloadedDataValid(email)) {
      const preloadedData = this.preloadedConversations.get(email);
      if (preloadedData && Array.isArray(preloadedData.orders) && preloadedData.orders.length > 0) {
        console.log(`✅ Found preloaded data for ${email}: ${preloadedData.orders.length} orders`);
        this.allOrders = [...preloadedData.orders];
        // console.log(`DEBUG: performAutoSearch - Calling displayOrdersList for ${email}. allOrders.length: ${this.allOrders.length}`);
        this.displayOrdersList();
        // Ensure correct status is set after displayOrdersList
        this.setStatus(`Found ${this.allOrders.length} order(s)`);
        return;
      }
    }

    // Set search in progress
    this.searchInProgress = true;
    this.activeSearches.set(email, true);
    
    // Show email detection status
    this.setStatus(`Found email: ${email}`);
    
    // Debounce API calls (but not cache checks)
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(async () => {
      try {
        // Show searching status
        this.setStatus("Searching orders...");
        
        // console.log(`🔍 Starting search for: ${email}`);
        const orderResults = await this.searchWooCommerceOrders(email);
        
        if (Array.isArray(orderResults)) {
          // console.log(`DEBUG: performAutoSearch - Before allOrders assignment. Received orderResults.length: ${orderResults ? orderResults.length : 'null/undefined'}. Current allOrders.length: ${this.allOrders.length}`);
          this.allOrders = [...orderResults];
          // console.log(`DEBUG: performAutoSearch - After allOrders assignment. New allOrders.length: ${this.allOrders.length}`);
          // console.log(`DEBUG: performAutoSearch - Calling displayOrdersList for ${email}. allOrders.length: ${this.allOrders.length}`);
          this.displayOrdersList();
          // Ensure correct status is set after displayOrdersList
          if (this.allOrders.length > 0) {
            this.setStatus(`Found ${this.allOrders.length} order(s)`);
          } else {
            this.setStatus("No orders found");
          }
        } else {
          // console.log("❌ Invalid order results:", orderResults);
          this.setStatus("No orders found");
        }
        
      } catch (error) {
        console.error("❌ Search failed:", error);
        this.setStatus("Search failed");
      } finally {
        this.searchInProgress = false;
        this.activeSearches.delete(email);
        this.lastSearchedEmail = email;
      }
    }, 300);
  }

  // Clear current email's data immediately
  clearCurrentEmailData() {
    console.log("🧹 Clearing current email data...");
    
    // Always clear the display when switching emails
    // Clear the results display
    const resultsContainer = document.getElementById("results");
    if (resultsContainer) {
      resultsContainer.innerHTML = '';
      console.log("🧹 Cleared results container");
    }
    
    // Clear any error messages
    const errorElement = document.getElementById("error");
    if (errorElement) {
      errorElement.classList.add("hidden");
      errorElement.textContent = ''; // Clear the error text content
      console.log("🧹 Hidden error element and cleared text");
    }
    
    // Clear any "No orders found" messages that might be in the results container
    const noOrdersElements = document.querySelectorAll('.no-orders, .error-message');
    noOrdersElements.forEach(element => {
      element.remove();
      console.log("🧹 Removed no-orders element");
    });
    
    // Clear status message to show we're switching emails
    this.setStatus("Switching emails...");
    
    console.log("✅ Current email data cleared");
  }

  // Trigger dynamic preloading with debouncing
  triggerDynamicPreloading() {
    // Debounce preloading to avoid excessive API calls
    if (this.preloadingDebounceTimer) {
      clearTimeout(this.preloadingDebounceTimer);
    }
    
    this.preloadingDebounceTimer = setTimeout(async () => {
      if (this.isMissiveEnvironment && !this.preloadingInProgress) {
        console.log("🔄 Triggering dynamic preloading...");
        await this.preloadVisibleConversations();
      }
    }, 2000); // Wait 2 seconds after last conversation change
  }

  // Initialize preloading on app start
  async initializePreloading() {
    if (this.isMissiveEnvironment) {
      console.log("🚀 Initializing Team Inbox preloading...");
      // Set status to Ready immediately to prevent getting stuck
      this.setStatus("Ready");
      
      // Wait a bit for Missive to be ready, then try preloading
      setTimeout(async () => {
        try {
          await this.preloadVisibleConversations();
          // Log preloading status after initialization
          this.logPreloadingStatus();
        } catch (error) {
          console.error("❌ Preloading failed, but app is ready:", error);
          this.setStatus("Ready");
        }
      }, 3000);
    } else {
      // Not in Missive environment, just set ready
      this.setStatus("Ready");
    }
  }

  // Debug method to check preloading status
  logPreloadingStatus() {
    console.log("📊 === PRELOADING STATUS ===");
    console.log(`📧 Seen conversation IDs: ${this.seenConversationIds.size}`);
    console.log(`📧 Preloaded conversations: ${this.preloadedConversations.size}`);
    console.log(`📧 Visible conversation IDs: ${this.visibleConversationIds.size}`);
    console.log(`📧 Email cache size: ${this.emailCache.size}`);
    
    if (this.preloadedConversations.size > 0) {
      console.log("📧 Preloaded emails:");
      for (const [email, data] of this.preloadedConversations) {
        console.log(`  - ${email}: ${data.orders.length} orders (age: ${Math.round((Date.now() - data.timestamp) / 1000)}s)`);
      }
    }
    console.log("📊 === PRELOADING STATUS END ===");
  }

  // Manual trigger for preloading (for testing)
  async triggerPreloading() {
          // console.log("🔧 Manual preloading trigger...");
    await this.preloadVisibleConversations();
    this.logPreloadingStatus();
  }

  cleanup() {
    // Clear timers
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    
    if (this.preloadingDebounceTimer) {
      clearTimeout(this.preloadingDebounceTimer);
      this.preloadingDebounceTimer = null;
    }
    
    // Clear cache
    this.emailCache.clear();
    this.visibleEmails.clear();
    
    // Clear preloading data
    this.preloadedConversations.clear();
    this.visibleConversationIds.clear();
    
    // Clear performance caches
    this.orderCache = {};
    this.katanaOrderCache = {};
    this.serialNumberCache = {};
    
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

  clearCaches() {
    console.log('Clearing all performance caches...');
    this.orderCache = {};
    this.katanaOrderCache = {};
    this.serialNumberCache = {};
    this.cacheExpiry.clear();
    this.preloadedConversations.clear();
    console.log('Performance caches and preloaded data cleared');
  }

  isCacheValid(key, cacheType) {
    const expiryKey = `${cacheType}-${key}`;
    const expiryTime = this.cacheExpiry.get(expiryKey);
    
    // If no expiry time is set, consider it valid (more lenient)
    if (!expiryTime) return true;
    
    const now = Date.now();
    const isValid = now < expiryTime;
    
    if (!isValid) {
      console.log(`Cache expired for ${cacheType}:${key}`);
      this.cacheExpiry.delete(expiryKey);
    }
    
    return isValid;
  }

  setCacheExpiry(key, cacheType) {
    const expiryKey = `${cacheType}-${key}`;
    const expiryTime = Date.now() + this.cacheConfig[cacheType];
    this.cacheExpiry.set(expiryKey, expiryTime);
  }

  // Add cleanup on page unload (using beforeunload instead of unload)
  setupCleanup() {
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  // Remove all diagnostic methods - they're causing crashes
  // debugMissiveStatus, scanDOMStructure, monitorClicks, testAutoSearch, etc.
  
  forceMissiveEnvironment() {
    console.log("🔄 Forcing Missive environment...");
    this.isMissiveEnvironment = true;
    this.autoSearchEnabled = true;
    this.updateUIForEnvironment();
    this.setupMissiveEventListeners();
    console.log("✅ Missive environment forced");
  }

  bindSimpleEvents() {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const statusMessage = document.getElementById('statusMessage');
    const statusText = document.getElementById('statusText');

    if (searchButton) {
      searchButton.onclick = () => this.handleSearch();
    }

    if (searchInput) {
      searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') this.handleSearch();
      };
    }

    if (statusMessage) {
      statusMessage.style.display = 'block';
      statusText.textContent = 'Ready';
    }

    // No clipboard/paste helper in Missive UI to keep it minimal and standard
  }

  bindWebEvents() {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    
    if (searchButton) {
      searchButton.onclick = () => this.handleSearch();
    }
    
    if (searchInput) {
      searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') this.handleSearch();
      };
    }
    
    // No force/paste helpers in Web UI to keep parity with Missive
  }
  
  log(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    const diagnosticLog = document.getElementById('diagnosticLog');
    
    if (logContent && diagnosticLog) {
      const timestamp = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
      entry.textContent = `[${timestamp}] ${message}`;
      logContent.appendChild(entry);
      logContent.scrollTop = logContent.scrollHeight;
      
      // Show the log if it was hidden
      if (diagnosticLog.style.display === 'none') {
        diagnosticLog.style.display = 'block';
      }
    }
    
    // Also log to console
    console.log(`�� ${message}`);
  }
}

// Make MissWooApp globally available for other modules
window.MissWooApp = MissWooApp;

// Initialize the app and handle any errors
try {
  console.log("Starting Miss-Woo application...");
  
  // Get configuration from window.config
  const config = window.config;
  if (!config) {
    throw new Error('Configuration not found. Make sure config.js is loaded before app.js');
  }
  
  // Check if we're in Missive environment and if Missive JS integration is present
  const isMissiveEnvironment = window.Missive !== undefined;
  const missiveJSIntegrationPresent = document.querySelector('script[src*="integrations/missive-js/app.js"]') !== null;
  
  if (isMissiveEnvironment && missiveJSIntegrationPresent) {
    console.log("Missive environment detected with JS integration - skipping direct initialization");
    console.log("MissiveJSBridge will handle app initialization");
  } else {
    console.log("Initializing MissWooApp directly (web mode or no JS integration)");
    window.app = new MissWooApp(config);
  }
  
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