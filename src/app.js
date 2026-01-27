// Miss-Woo Frontend Application

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
      this.inFlightKatanaRequests = new Map(); // Track in-flight Katana order requests to prevent duplicates
      this.corsHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      
      // Caching system
      this.katanaOrderCache = new Map();
      this.serialNumberCache = new Map();
      this.emailCache = new Map();
      this.cacheExpiry = new Map();
      this.visibleEmails = new Set(); // Track visible emails for cleanup
      this.salesExportData = new Map(); // Historical sales export data (order_no -> records)
      this.salesExportDataLoaded = false; // Track if data has been loaded
      this._salesDataLoadingPromise = null; // Track background loading promise
      this.searchCache = new Map(); // Memoize recent search results
      
      // Store bound function references for proper event listener removal
      this.boundHandleSearch = this.handleSearch.bind(this);
      this.boundKeyPressHandlers = new Map(); // Store keypress handlers by element
      this.conversationChangeDebounceTimer = null; // Debounce for conversation change events
      this.maxRecentlyOpenedConversations = 15; // Cache 15 most recently opened conversations
      this.recentlyOpenedConversations = new Map(); // LRU cache: conversationId -> { email, timestamp, processed }
      this.processingConversationId = null; // Track currently processing conversation to prevent duplicates
      this.lastConversationId = null; // Track last conversation ID to prevent duplicate debounce timers
      this.inFlightSerialRequests = new Map(); // Request deduplication for serial number fetching
      
      // Cache configuration
      this.cacheConfig = {
        katanaCache: 10 * 60 * 1000, // 10 minutes  
        serialCache: 30 * 60 * 1000, // 30 minutes
        emailCache: 2 * 60 * 1000, // 2 minutes
        maxCacheSize: 100 // Maximum number of entries in emailCache
      };
      
      // Search state management
      this.allOrders = [];
      this.lastSearchedEmail = null;
      this.searchDebounceTimer = null;
      this.searchInProgress = false; // Prevent multiple searches from running simultaneously
      this.activeSearches = new Map(); // Track active searches by email
      this.activeSearchAbortController = null; // OPTIMIZATION 4: Request cancellation
      
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
    console.time('init:missive');
    
    try {
      // Wait for Missive API to be available — prefer script onload, fallback to short poll
      await new Promise((resolve, reject) => {
        if (window.Missive) {
          console.timeEnd('init:missive');
          return resolve();
        }

        // Try to find the script tag that loads the Missive SDK
        const script = document.querySelector('script[src*="integrations.missiveapp.com/missive.js"]');
        let resolved = false;
        
        const cleanup = () => {
          if (script) {
            script.removeEventListener('load', onLoad);
            script.removeEventListener('error', onError);
          }
          if (poller) clearInterval(poller);
          if (timeout) clearTimeout(timeout);
        };

        const onLoad = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          console.timeEnd('init:missive');
          resolve();
        };
        
        const onError = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(new Error('Missive script failed to load'));
        };

        if (script) {
          // If script already loaded, check immediately
          if (script.complete || script.readyState === 'complete') {
            if (window.Missive) {
              resolved = true;
              cleanup();
              console.timeEnd('init:missive');
              resolve();
              return;
            }
          }
          script.addEventListener('load', onLoad);
          script.addEventListener('error', onError);
        }

        // Short poll fallback up to 2s (reduced from 3s for faster cold-start)
        const poller = setInterval(() => {
          if (window.Missive) {
            if (resolved) return;
            resolved = true;
            cleanup();
            console.timeEnd('init:missive');
            resolve();
          }
        }, 100); // Reduced from 150ms to 100ms for faster detection

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            console.timeEnd('init:missive');
            reject(new Error('Missive API not available after 2s timeout'));
          }
        }, 2000); // Reduced from 3s to 2s for faster cold-start
      });

      console.log("✅ Missive API detected");
      
      // Set up event listeners
      this.setupMissiveEventListeners();
      
      // Note: tryGetCurrentContext removed - events handle conversation changes automatically
      
    } catch (error) {
      console.error("❌ Missive API not available quickly:", error);
      this.setStatus("Missive API not available", 'error');
      // Don't block the app — continue without Missive
    }
  }

  // Debounce utility function
  debounce(fn, wait = 300) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Cache search results with TTL
  cacheSearchResults(email, results) {
    const cacheKey = `search:${email}`;
    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    
    // Limit cache size to 50 entries (LRU eviction)
    if (this.searchCache.size > 50) {
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
  }

  setupMissiveEventListeners() {
    console.log("🔧 Setting up Missive event listeners...");
    
    try {
      // OPTIMIZATION: In Missive environment, MissiveJSBridge forwards events
      // Only set up direct listeners if NOT using MissiveJSBridge (web/standalone mode)
      if (this.isMissiveEnvironment) {
        console.log("ℹ️ Missive environment detected - events will be forwarded by MissiveJSBridge");
        console.log("✅ Skipping direct event listeners (handled by bridge)");
        return;
      }
      
      // Create debounced handlers to avoid excessive event processing
      this.debouncedHandleConversationChange = this.debounce((data) => {
        console.log("📧 Conversation changed:", data);
        this.handleConversationChange(data);
      }, 300);
      
      // Listen for conversation changes (only in non-Missive environments)
      if (Missive.on) {
        Missive.on('change:conversations', this.debouncedHandleConversationChange);
        console.log("✅ change:conversations listener set up (debounced)");
      }
      
      // Note: email:focus event doesn't exist in Missive API, removed per API review
      
    } catch (error) {
      console.error("❌ Failed to set up Missive event listeners:", error);
    }
  }

  // Removed tryGetCurrentContext - events handle conversation changes automatically

  async handleConversationChange(data) {
    console.log("📧 Handling conversation change:", data);
    
    try {
      // Check if data is an array of conversation IDs (from change:conversations event)
      // The first ID in the array is the currently clicked/opened conversation
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
        const clickedConversationId = data[0]; // First ID is the one user clicked on
        console.log(`📧 User clicked on conversation: ${clickedConversationId}`);
        
        // OPTIMIZATION: Prevent duplicate processing if already in progress
        if (this.processingConversationId === clickedConversationId) {
          console.log(`⏳ Conversation ${clickedConversationId} already being processed, skipping duplicate`);
          return;
        }
        
        // OPTIMIZATION: Also check if we're already handling this (debounce protection)
        if (this.conversationChangeDebounceTimer && this.lastConversationId === clickedConversationId) {
          console.log(`⏳ Conversation ${clickedConversationId} already queued for processing, skipping duplicate`);
          return;
        }
        
        // Track the last conversation ID being processed
        this.lastConversationId = clickedConversationId;
        
        // Check if we've already processed this conversation
        const cached = this.recentlyOpenedConversations.get(clickedConversationId);
        if (cached && cached.processed) {
          console.log(`✅ Conversation ${clickedConversationId} already processed, using cached data`);
          // If we have cached email, trigger search with it
          if (cached.email && this.isValidEmailForSearch(cached.email)) {
            this.performAutoSearch(cached.email);
          }
          return;
        }
        
        // Debounce to prevent rapid-fire processing when user clicks quickly
        if (this.conversationChangeDebounceTimer) {
          clearTimeout(this.conversationChangeDebounceTimer);
        }
        
        this.conversationChangeDebounceTimer = setTimeout(async () => {
          this.lastConversationId = null; // Clear after processing starts
          await this.processClickedConversation(clickedConversationId);
        }, 100); // Short debounce (100ms) for responsive feel
        
        return;
      }
      
      // Handle single conversation object (backward compatibility)
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

  // Removed handleEmailFocus - email:focus event doesn't exist in Missive API

  getVersion() {
    // Default shown until manifest loads; will be replaced by GH-<sha>
    return 'vJS5.06';
  }

  // Removed loadVersionFromManifest - was empty, version handled in updateHeaderWithVersion()

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
      
      // Initialize Missive API integration
      // OPTIMIZATION: Show UI immediately, then load data in background
      this.setStatus("Ready"); // Set Ready immediately - don't wait for anything
      this.hideLoading(); // Show UI right away
      
      // OPTIMIZATION: Don't block initialization on sales export data
      // Start it in background - it will load lazily when needed (orders <= 19769)
      // This makes cold-start much faster (only wait for Missive API, not large JSON download)
      const initPromises = [];
      
      if (this.isMissiveEnvironment) {
        initPromises.push(this.initializeMissiveAPI());
      }
      
      // Start sales export data loading in background (non-blocking)
      // It will be ready when needed, or we'll wait for it only when searching orders <= 19769
      initPromises.push(
        this.loadSalesExportData().catch(err => {
          console.warn('Background sales data load failed (will retry when needed):', err);
        })
      );
      
      // Continue with other setup while data loads in background
      this.maybeAutoSearchFromUrl();
      this.setupCleanup(); // Setup proper cleanup
      
      // Wait for critical initialization (but UI is already shown)
      await Promise.all(initPromises);
      
      // Only test connection if not in Missive environment (non-blocking)
      if (!this.isMissiveEnvironment) {
        // Test connection in background - don't block UI
        this.testConnection().catch(err => {
          console.warn('Connection test failed:', err);
        });
      }
      console.log("Application initialized successfully");
      
      // Add debug methods to global scope for testing
      window.MissWooDebug = {
        getCachedEmails: () => Array.from(this.emailCache.keys()),
        getRecentlyOpenedConversations: () => Array.from(this.recentlyOpenedConversations.keys()),
        clearCaches: () => { this.emailCache.clear(); this.recentlyOpenedConversations.clear(); console.log("Cleared caches"); }
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

      // Bind classic UI - store references for proper cleanup
      if (searchBtnA) {
        searchBtnA.addEventListener("click", this.boundHandleSearch);
        this.boundSearchBtnA = searchBtnA; // Store reference for cleanup
      }
      if (searchInputA) {
        const keyPressHandlerA = (e) => {
          if (e.key === "Enter") this.handleSearch();
        };
        searchInputA.addEventListener("keypress", keyPressHandlerA);
        this.boundKeyPressHandlers.set(searchInputA, keyPressHandlerA);
        this.boundSearchInputA = searchInputA; // Store reference for cleanup
      }

      // Bind dynamic UI - store references for proper cleanup
      if (searchBtnB) {
        searchBtnB.addEventListener("click", this.boundHandleSearch);
        this.boundSearchBtnB = searchBtnB; // Store reference for cleanup
      }
      if (searchInputB) {
        const keyPressHandlerB = (e) => {
          if (e.key === "Enter") this.handleSearch();
        };
        searchInputB.addEventListener("keypress", keyPressHandlerB);
        this.boundKeyPressHandlers.set(searchInputB, keyPressHandlerB);
        this.boundSearchInputB = searchInputB; // Store reference for cleanup
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

    // OPTIMIZATION 4: Cancel any previous search requests
    if (this.activeSearchAbortController) {
      console.log("Cancelling previous search requests");
      this.activeSearchAbortController.abort();
    }
    // Create new AbortController for this search
    this.activeSearchAbortController = new AbortController();

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
      // Don't log abort errors as errors
      if (error.name === 'AbortError' || error.message === 'Search cancelled') {
        console.log("Search cancelled");
        return;
      }
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
      const order = await this.makeRequest(url, {
        signal: this.activeSearchAbortController?.signal
      });
      
      if (!order || !order.id) {
        this.showError(`Order ${orderId} not found`);
        return;
      }

      // OPTIMIZATION 3: Initialize notes as empty array - notes will be fetched in displayOrdersList when needed
      order.notes = [];

      this.allOrders = [order];
      
      // Display orders immediately with basic info (shows "Loading..." for serial/tracking)
      await this.displayOrdersList();
      
      // Then load additional details in background (non-blocking)
      // This allows the UI to be responsive while data loads
      this.loadOrderDetails(this.allOrders).then(() => {
        // Update UI with enhanced data (tracking numbers, serial numbers, etc.)
        // Instead of re-rendering entire list, just update the cells that changed
        this.updateOrderDetailsUI(this.allOrders);
      }).catch(error => {
        console.error(`❌ Error loading additional details:`, error);
      });
        } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Get order cancelled");
        return;
      }
      console.error("Get order error:", error);
            this.showError(`Failed to fetch order ${orderId}: ${error.message}`);
        }
    }

  async searchOrdersByEmail(email) {
    // OPTIMIZATION: Normalize email first for consistent cache lookups
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return;
    }
    
    // Clear previous data if this is a new email search
    if (this.lastSearchedEmail !== normalizedEmail) {
      this.clearCurrentEmailData();
      this.lastSearchedEmail = normalizedEmail;
    }
    
    // Check emailCache first (unified caching) - use normalized email
    if (this.emailCache && this.emailCache.has(normalizedEmail) && this.isCacheValid(normalizedEmail, 'emailCache')) {
      const cachedOrders = this.emailCache.get(normalizedEmail);
      // OPTIMIZATION: Fast path - minimal logging for cache hits
      if (Array.isArray(cachedOrders)) {
        this.allOrders = cachedOrders;
        // Don't call displayOrdersList here - let the caller handle it
        return;
      }
    }
    
    try {
      // Search WooCommerce orders only
      const orderResults = await this.searchWooCommerceOrders(email);
      
      // OPTIMIZATION 4: Check if search was cancelled
      if (this.activeSearchAbortController?.signal.aborted) {
        console.log("Search was cancelled");
        throw new Error('Search cancelled');
      }
      
      // Ensure orderResults is an array
      if (!Array.isArray(orderResults)) {
        console.error("searchWooCommerceOrders returned non-array:", orderResults);
        this.allOrders = [];
        return;
      }
      
      // Set results
      this.allOrders = orderResults;
      // Don't call displayOrdersList here - let the caller handle it
      
      // Cache the results in emailCache (unified caching) - use normalized email
      if (this.emailCache) {
        this.emailCache.set(normalizedEmail, orderResults); // No need to clone for cache
        this.setCacheExpiry(normalizedEmail, 'emailCache');
        // OPTIMIZATION: Enforce cache size limit
        this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Search cancelled') {
        console.log("Search cancelled");
        throw error;
      }
      console.error("Search error:", error);
      this.showError(`Failed to search: ${error.message}`);
    } finally {
      // Reset search in progress when search completes
      this.searchInProgress = false;
    }
  }

  async searchWooCommerceOrders(email) {
    let allOrders = [];
    const maxPages = 3; // Reduced from 5 to 3 pages for faster search
    const maxMatchingOrders = 5; // Stop when we have enough matches

    try {
      // OPTIMIZATION 2: Fetch first page immediately to show results faster
      const firstPageUrl = this.getAuthenticatedUrl('/orders', {
        search: email,
        per_page: 100,
        page: 1,
        orderby: 'date',
        order: 'desc'
      });
      
      const firstPageData = await this.makeRequest(firstPageUrl, {
        signal: this.activeSearchAbortController?.signal
      });
      
      // Ensure firstPageData is an array
      if (!Array.isArray(firstPageData)) {
        return [];
      }
      
      if (firstPageData.length > 0) {
        allOrders = allOrders.concat(firstPageData);
        
        // OPTIMIZATION 2: Check if we have enough exact matches after first page - early return
        const matchingAfterFirstPage = this.filterOrdersByEmail(allOrders, email);
        if (matchingAfterFirstPage.length >= maxMatchingOrders) {
          // OPTIMIZATION: Early return - no need to slice, filterOrdersByEmail already returns max 5
          const processedOrders = await this.processOrdersWithDetails(matchingAfterFirstPage, email);
          const results = Array.isArray(processedOrders) ? processedOrders : [];
          this.cacheSearchResults(email, results);
          return results;
        }
        
        // OPTIMIZATION 2: Fetch pages 2 and 3 in parallel for faster results
        const page2Url = this.getAuthenticatedUrl('/orders', {
          search: email,
          per_page: 100,
          page: 2,
          orderby: 'date',
          order: 'desc'
        });
        
        const page3Url = this.getAuthenticatedUrl('/orders', {
          search: email,
          per_page: 100,
          page: 3,
          orderby: 'date',
          order: 'desc'
        });
        
        // Fetch pages 2 and 3 in parallel
        const [page2Data, page3Data] = await Promise.all([
          this.makeRequest(page2Url, {
            signal: this.activeSearchAbortController?.signal
          }).catch(err => {
            if (err.name === 'AbortError') throw err;
            console.error("Error fetching page 2:", err);
            return [];
          }),
          this.makeRequest(page3Url, {
            signal: this.activeSearchAbortController?.signal
          }).catch(err => {
            if (err.name === 'AbortError') throw err;
            console.error("Error fetching page 3:", err);
            return [];
          })
        ]);
        
        // Add page 2 results if valid
        if (Array.isArray(page2Data) && page2Data.length > 0) {
          allOrders = allOrders.concat(page2Data);
          
          // OPTIMIZATION 2: Check if we have enough matches after page 2 - early return
          const matchingAfterPage2 = this.filterOrdersByEmail(allOrders, email);
          if (matchingAfterPage2.length >= maxMatchingOrders) {
            // OPTIMIZATION: Early return - no need to slice, filterOrdersByEmail already returns max 5
            const processedOrders = await this.processOrdersWithDetails(matchingAfterPage2, email);
            const results = Array.isArray(processedOrders) ? processedOrders : [];
            this.cacheSearchResults(email, results);
            return results;
          }
        }
        
        // Add page 3 results if valid
        if (Array.isArray(page3Data) && page3Data.length > 0) {
          allOrders = allOrders.concat(page3Data);
        }
      }

      // OPTIMIZATION: Filter for exact email matches (filterOrdersByEmail already returns max 5)
      const matchingOrders = this.filterOrdersByEmail(allOrders, email);

      // OPTIMIZATION 3: Process order details (without notes - notes fetched later)
      const processedOrders = await this.processOrdersWithDetails(matchingOrders, email);
      const results = Array.isArray(processedOrders) ? processedOrders : [];
      
      // Memoize results
      this.cacheSearchResults(email, results);
      
      return results;
      
    } catch (error) {
      // Don't log abort errors as errors
      if (error.name === 'AbortError') {
        console.log("Search cancelled");
        throw error;
      }
      console.error("Error in searchWooCommerceOrders:", error);
      return [];
    }
  }

  // OPTIMIZATION: Early termination - stop once we have 5 matches (much faster)
  filterOrdersByEmail(orders, email) {
    const normalizedEmail = email.toLowerCase();
    const matches = [];
    
    // Stop early once we have 5 matches - avoids processing remaining orders
    for (const order of orders) {
      if (matches.length >= 5) break;
      
      const orderEmail = order.billing?.email || '';
      if (orderEmail.toLowerCase() === normalizedEmail) {
        matches.push(order);
      }
    }
    
    return matches;
  }

  async processOrdersWithDetails(orders, email) {
    // OPTIMIZATION 3: Notes are now fetched lazily when needed for tracking extraction
    // This allows faster initial display of orders
    // Initialize notes as empty array - notes will be fetched in displayOrdersList when needed
    for (const order of orders) {
      if (!order.notes) {
        order.notes = [];
      }
    }
    
    this.allOrders = orders;
    
    // Cache the results with expiration (unified caching)
    if (this.emailCache) {
      this.emailCache.set(email, orders);
      this.setCacheExpiry(email, 'emailCache');
      // OPTIMIZATION: Enforce cache size limit
      this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
      console.log(`Cached ${orders.length} processed orders for ${email} in emailCache`);
    }
    
    // Return the orders
    return orders;
  }

  // OPTIMIZATION: Cache base URL construction to avoid repeated string operations
  getAuthenticatedUrl(endpoint, params = {}) {
    // Ensure we have a valid base URL
    if (!this.apiBaseUrl) {
      throw new Error("API base URL is not configured");
    }
    
    // OPTIMIZATION: Cache base URL normalization
    if (!this._cachedBaseUrl) {
      this._cachedBaseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl : this.apiBaseUrl + '/';
    }
    
    const fullUrl = this._cachedBaseUrl + endpoint.replace(/^\//, ''); // Remove leading slash if present
    
    try {
      const url = new URL(fullUrl);
      url.searchParams.set('consumer_key', this.consumerKey);
      url.searchParams.set('consumer_secret', this.consumerSecret);
      
      // Add additional parameters
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      return url.toString();
    } catch (error) {
      console.error("Failed to construct URL:", error);
      throw new Error(`Invalid URL construction: ${error.message}`);
    }
  }

  async makeRequest(url, options = {}) {
    // OPTIMIZATION: Request deduplication - if same request is pending, wait for it
    const requestKey = `${url}-${JSON.stringify(options)}`;
    if (this.pendingRequests.has(requestKey)) {
      return this.requestQueue.get(requestKey);
    }
    
    // OPTIMIZATION: Cache URL construction to avoid repeated string operations
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
          signal: options.signal, // OPTIMIZATION 4: Support request cancellation
          ...options
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        // OPTIMIZATION: Removed excessive logging in hot path
        return data;
        } catch (error) {
        // Don't log abort errors as errors - they're intentional cancellations
        if (error.name === 'AbortError') {
          console.log("Request cancelled:", url);
          throw error;
        }
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
    
    // OPTIMIZATION: Don't fetch serial numbers/notes here to avoid duplicate API calls
    // loadOrderDetails() will handle fetching all details. Just show "Loading..." placeholders.
    // Update from cache if available, otherwise show "Loading..."
    for (const order of this.allOrders) {
      const serialCell = document.getElementById(`serial-${order.id}`);
      if (serialCell) {
        if (this.serialNumberCache && this.serialNumberCache.has(order.number) && this.isCacheValid(order.number, 'serialCache')) {
          serialCell.textContent = this.serialNumberCache.get(order.number);
        } else {
          serialCell.textContent = "Loading...";
        }
      }
      
      // If notes are already loaded (from cache), extract tracking info immediately
      const trackingCell = document.getElementById(`tracking-${order.id}`);
      if (trackingCell && order.notes && order.notes.length > 0) {
        const trackingInfo = this.getTrackingInfo(order);
        if (trackingInfo) {
          const trackingLink = document.createElement("a");
          trackingLink.href = trackingInfo.url;
          trackingLink.target = "_blank";
          trackingLink.textContent = trackingInfo.number;
          trackingCell.innerHTML = "";
          trackingCell.appendChild(trackingLink);
        } else {
          trackingCell.textContent = "Loading...";
        }
      } else if (trackingCell) {
        trackingCell.textContent = "Loading...";
      }
    }
    
    // Removed startBackgroundProcessing - was unused
    } finally {
      this._displayInProgress = false;
      // console.log("DEBUG: displayOrdersList finished. _displayInProgress set to false.");
    }
  }

  // Update order details UI after loadOrderDetails completes (avoids re-rendering entire list)
  updateOrderDetailsUI(orders) {
    if (!orders || orders.length === 0) return;
    
    for (const order of orders) {
      // Update serial number
      const serialCell = document.getElementById(`serial-${order.id}`);
      if (serialCell) {
        if (this.serialNumberCache && this.serialNumberCache.has(order.number) && this.isCacheValid(order.number, 'serialCache')) {
          serialCell.textContent = this.serialNumberCache.get(order.number);
        } else {
          serialCell.textContent = "N/A";
        }
      }
      
      // Update tracking info
      const trackingCell = document.getElementById(`tracking-${order.id}`);
      if (trackingCell && order.notes && order.notes.length > 0) {
        const trackingInfo = this.getTrackingInfo(order);
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
      } else if (trackingCell) {
        trackingCell.textContent = "N/A";
      }
    }
  }

  // Removed startBackgroundProcessing - was unused


  // Silent version of searchOrdersByEmail that doesn't set status messages
  getPerformanceStats() {
    return {
      cacheHits: {
        katana: this.katanaOrderCache ? this.katanaOrderCache.size : 0,
        serials: this.serialNumberCache ? this.serialNumberCache.size : 0,
        emails: this.emailCache ? this.emailCache.size : 0
      },
      pendingRequests: this.pendingRequests.size,
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

  // Load sales export data from JSON file (with caching and Web Worker parsing)
  // OPTIMIZATION: This is now lazy-loaded - only loads when needed (orders <= 19769)
  async loadSalesExportData() {
    // Prevent duplicate concurrent loads
    if (this._salesDataLoadingPromise && !this.salesExportDataLoaded) {
      return this._salesDataLoadingPromise;
    }
    
    console.log('📚 Loading sales export data for historical orders...');
    console.time('load:sales-data');
    
    // Create loading promise
    this._salesDataLoadingPromise = this._doLoadSalesExportData().finally(() => {
      this._salesDataLoadingPromise = null;
    });
    
    return this._salesDataLoadingPromise;
  }
  
  async _doLoadSalesExportData() {
    try {
      const salesExportUrl = this.isMissiveEnvironment 
        ? 'sales_export_filtered.json' 
        : 'sales_export_filtered.json';
      
      const cacheKey = 'sales_export_index_v1';
      const cacheTimestampKey = 'sales_export_timestamp';
      const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
      
      // Check cache first
      try {
        const cached = localStorage.getItem(cacheKey);
        const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
        
        if (cached && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp, 10);
          if (age < CACHE_TTL) {
            const cachedData = JSON.parse(cached);
            // Restore the Map from cached data
            for (const [orderNo, record] of Object.entries(cachedData.idMap || {})) {
              this.salesExportData.set(orderNo, record);
            }
            this.salesExportDataLoaded = true;
            console.log(`✅ Loaded sales export data from cache (${this.salesExportData.size} orders, age: ${Math.round(age / 1000)}s)`);
            console.timeEnd('load:sales-data');
            return;
          } else {
            console.log('📦 Cache expired, fetching fresh data...');
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);
          }
        }
      } catch (e) {
        console.warn('⚠️ Cache read failed, will fetch fresh:', e);
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(cacheTimestampKey);
      }
      
      // Use Web Worker to parse JSON in background (doesn't block UI)
      if (typeof Worker !== 'undefined') {
        try {
          const worker = new Worker('worker/parse-sales-worker.js');
          const parsePromise = new Promise((resolve, reject) => {
            worker.onmessage = (msg) => {
              const data = msg.data;
              if (data && data.success) {
                // Restore the Map from worker result
                for (const [orderNo, record] of Object.entries(data.idMap || {})) {
                  this.salesExportData.set(orderNo, record);
                }
                
                // Cache the parsed index
                try {
                  localStorage.setItem(cacheKey, JSON.stringify({ idMap: data.idMap }));
                  localStorage.setItem(cacheTimestampKey, String(Date.now()));
                } catch (e) {
                  console.warn('⚠️ Could not cache order index to localStorage:', e);
                }
                
                this.salesExportDataLoaded = true;
                console.log(`✅ Loaded sales export data via worker (${this.salesExportData.size} orders)`);
                console.timeEnd('load:sales-data');
                resolve();
              } else {
                reject(new Error(data.error || 'Worker failed'));
              }
              worker.terminate();
            };

            worker.onerror = (err) => {
              worker.terminate();
              reject(err);
            };
          });

          worker.postMessage({ action: 'parse', url: salesExportUrl });
          await parsePromise;
          return;
        } catch (workerError) {
          console.warn('⚠️ Web Worker not available, falling back to main thread parsing:', workerError);
          // Fall through to main thread parsing
        }
      }
      
      // Fallback: Parse on main thread if worker unavailable
      console.log(`📁 Loading from: ${salesExportUrl}`);
      const response = await fetch(salesExportUrl, {
        cache: 'default' // Allow browser caching instead of 'no-cache'
      });
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📦 Received data: ${Array.isArray(data) ? `Array with ${data.length} items` : typeof data}`);
        
        if (Array.isArray(data)) {
          const idMap = {};
          // Group by SalesOrderNo for fast lookup
          for (const record of data) {
            const orderNo = String(record.SalesOrderNo);
            const orderNoInt = parseInt(orderNo);
            if (!isNaN(orderNoInt)) {
              this.salesExportData.set(orderNo, record);
              idMap[orderNo] = record;
            }
          }
          
          // Cache the parsed index
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ idMap }));
            localStorage.setItem(cacheTimestampKey, String(Date.now()));
          } catch (e) {
            console.warn('⚠️ Could not cache order index to localStorage:', e);
          }
        } else {
          console.log('⚠️ Sales export data is not an array:', typeof data);
        }
        this.salesExportDataLoaded = true;
        console.log(`✅ Loaded sales export data for ${this.salesExportData.size} orders`);
        console.timeEnd('load:sales-data');
      } else if (response.status === 404) {
        console.log('ℹ️ Sales export data file not found (this is optional)');
        this.salesExportDataLoaded = true;
        console.timeEnd('load:sales-data');
      } else {
        console.log(`⚠️ Could not load sales export data: ${response.status}`);
        this.salesExportDataLoaded = true;
        console.timeEnd('load:sales-data');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      console.log('ℹ️ Sales export data not available (this is optional):', error.message);
      this.salesExportDataLoaded = true;
      console.timeEnd('load:sales-data');
    }
  }

  // Get serial numbers and keys from sales export data for older orders
  getSalesExportData(orderNumber) {
    // If data not loaded yet, trigger lazy load (non-blocking)
    if (!this.salesExportDataLoaded) {
      // Start loading in background if not already started
      if (!this._salesDataLoadingPromise) {
        this._salesDataLoadingPromise = this.loadSalesExportData().catch(err => {
          console.warn('Lazy sales data load failed:', err);
          this._salesDataLoadingPromise = null;
        });
      }
      return null; // Return null immediately, data will be available on next call
    }
    
    if (!this.salesExportData || this.salesExportData.size === 0) {
      console.log(`⚠️ Sales export data not available (loaded: ${this.salesExportDataLoaded}, size: ${this.salesExportData?.size || 0})`);
      return null;
    }
    
    const orderNoStr = String(orderNumber);
    console.log(`🔍 Looking up order #${orderNoStr} in sales export data (map size: ${this.salesExportData.size})`);
    
    const record = this.salesExportData.get(orderNoStr);
    
    if (!record) {
      console.log(`⚠️ No record found for order #${orderNoStr}`);
      // Debug: Show first few order numbers in map
      const firstFew = Array.from(this.salesExportData.keys()).slice(0, 5);
      console.log(`📋 First 5 order numbers in map:`, firstFew);
      return null;
    }
    
    console.log(`✅ Found record for order #${orderNoStr}:`, record);
    
    // New format: record already has SerialNumbers and Keys arrays (already combined)
    const serialNumbers = Array.isArray(record.SerialNumbers) ? record.SerialNumbers : [];
    const keys = Array.isArray(record.Keys) ? record.Keys : [];
    
    console.log(`📊 Extracted: ${serialNumbers.length} serial numbers, ${keys.length} keys`);
    
    return {
      serialNumbers: serialNumbers,
      keys: keys
    };
  }

  async getSerialNumber(order) {
    try {
      console.log(`Getting serial number for WooCommerce order #${order.number}`);
      
      // Check cache first with expiration
      if (this.serialNumberCache && this.serialNumberCache.has(order.number) && this.isCacheValid(order.number, 'serialCache')) {
        console.log(`Using cached serial numbers for order #${order.number}`);
        return this.serialNumberCache.get(order.number);
      }
      
      const orderNumber = parseInt(order.number);
      
      // For orders <= 19769, check sales export data first
      if (!isNaN(orderNumber) && orderNumber <= 19769) {
        console.log(`🔍 Order #${order.number} is <= 19769, checking sales export data...`);
        
        // Ensure data is loaded (wait if still loading)
        if (!this.salesExportDataLoaded) {
          console.log(`⏳ Sales export data not loaded yet, loading now for order #${order.number}...`);
          // Wait for background load if in progress, or start new load
          if (this._salesDataLoadingPromise) {
            await this._salesDataLoadingPromise;
          } else {
            await this.loadSalesExportData();
          }
        }
        
        const salesData = this.getSalesExportData(order.number);
        
        if (salesData) {
          console.log(`📊 Sales data retrieved for order #${order.number}:`, salesData);
          if (salesData.serialNumbers && salesData.serialNumbers.length > 0) {
            console.log(`✅ Found ${salesData.serialNumbers.length} serial numbers from sales export data for order #${order.number}`);
            
            // Format: Serial numbers, and Keys if available
            let result = salesData.serialNumbers.join(', ');
            if (salesData.keys && salesData.keys.length > 0) {
              result += ` (Keys: ${salesData.keys.join(', ')})`;
            }
            
            console.log(`📝 Formatted result: "${result}"`);
            this.serialNumberCache.set(order.number, result);
            this.setCacheExpiry(order.number, 'serialCache');
            return result;
          } else {
            console.log(`⚠️ Sales data found but no serial numbers (array length: ${salesData.serialNumbers?.length || 0})`);
          }
        } else {
          console.log(`⚠️ No sales export data found for order #${order.number}`);
        }
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
    // OPTIMIZATION: Request deduplication - reuse in-flight requests
    if (this.inFlightSerialRequests && this.inFlightSerialRequests.has(rowId)) {
      console.log(`⏳ Reusing in-flight request for serial numbers row ID: ${rowId}`);
      return await this.inFlightSerialRequests.get(rowId);
    }
    
    // Create a new request promise
    const requestPromise = (async () => {
      try {
        console.log(`Fetching serial numbers for row ID: ${rowId}`);
        // Use the row ID as resource_id to get serial numbers
        const url = `${this.katanaApiBaseUrl}/serial_numbers?resource_id=${rowId}&resource_type=SalesOrderRow`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.katanaApiKey}`,
            'Accept': 'application/json'
          },
          signal: this.activeSearchAbortController?.signal
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
        if (error.name === 'AbortError') {
          console.log("Serial numbers fetch cancelled");
          throw error;
        }
        console.error(`Error fetching serial numbers for row ID ${rowId}:`, error);
        return [];
      } finally {
        // Remove from tracking when done
        if (this.inFlightSerialRequests) {
          this.inFlightSerialRequests.delete(rowId);
        }
      }
    })();
    
    // Track the promise
    if (this.inFlightSerialRequests) {
      this.inFlightSerialRequests.set(rowId, requestPromise);
    }
    
    return requestPromise;
  }

  async getKatanaOrder(wooOrderNumber) {
    try {
      // Check cache first with expiration
      if (this.katanaOrderCache && this.katanaOrderCache.has(wooOrderNumber) && this.isCacheValid(wooOrderNumber, 'katanaCache')) {
        console.log(`Using cached Katana order for #${wooOrderNumber}`);
        return this.katanaOrderCache.get(wooOrderNumber);
      }
      
      // Check if there's already an in-flight request for this order
      if (this.inFlightKatanaRequests && this.inFlightKatanaRequests.has(wooOrderNumber)) {
        console.log(`⏳ Reusing in-flight request for Katana order #${wooOrderNumber}`);
        return await this.inFlightKatanaRequests.get(wooOrderNumber);
      }
      
      // Create a new request promise
      const requestPromise = (async () => {
        try {
          console.log(`Getting Katana order for WooCommerce order #${wooOrderNumber}`);
      
      const url = `${this.katanaApiBaseUrl}/sales_orders?order_no=${wooOrderNumber}`;
      console.log(`Fetching Katana order for WooCommerce order #${wooOrderNumber}:`, url);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.katanaApiKey}`,
          'Accept': 'application/json'
        },
        signal: this.activeSearchAbortController?.signal
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
      if (error.name === 'AbortError') {
        console.log("Katana order fetch cancelled");
        throw error;
      }
      console.error(`Error fetching Katana order for #${wooOrderNumber}:`, error);
      this.katanaOrderCache.set(wooOrderNumber, null);
      return null;
        } finally {
          // Clean up in-flight request tracking
          if (this.inFlightKatanaRequests) {
            this.inFlightKatanaRequests.delete(wooOrderNumber);
          }
        }
      })();
      
      // Store the in-flight request
      if (this.inFlightKatanaRequests) {
        this.inFlightKatanaRequests.set(wooOrderNumber, requestPromise);
      }
      
      return await requestPromise;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      // Clean up on error
      if (this.inFlightKatanaRequests) {
        this.inFlightKatanaRequests.delete(wooOrderNumber);
      }
      throw error;
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
        },
        signal: this.activeSearchAbortController?.signal
      });

      if (!response.ok) {
        console.log(`Could not get full order details for ${katanaOrderId}, status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`Full Katana order details for ID ${katanaOrderId}:`, data);
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Katana order details fetch cancelled");
        throw error;
      }
      console.error(`Error fetching full Katana order details for ${katanaOrderId}:`, error);
      return null;
    }
  }

  // OPTIMIZATION 1: Batch fetch all Katana orders in parallel for multiple WooCommerce orders
  async batchGetKatanaOrders(wooOrderNumbers) {
    try {
      // Separate cached and uncached orders
      const uncachedOrders = [];
      const cachedResults = new Map();
      
      for (const orderNumber of wooOrderNumbers) {
        if (this.katanaOrderCache && this.katanaOrderCache.has(orderNumber) && this.isCacheValid(orderNumber, 'katanaCache')) {
          cachedResults.set(orderNumber, this.katanaOrderCache.get(orderNumber));
        } else {
          uncachedOrders.push(orderNumber);
        }
      }
      
      if (uncachedOrders.length === 0) {
        return cachedResults;
      }
      
      // Fetch all uncached orders in parallel
      const fetchPromises = uncachedOrders.map(async (orderNumber) => {
        try {
          const katanaOrder = await this.getKatanaOrder(orderNumber);
          return { orderNumber, katanaOrder };
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          console.error(`Error in batch fetch for order ${orderNumber}:`, error);
          return { orderNumber, katanaOrder: null };
        }
      });
      
      const results = await Promise.all(fetchPromises);
      
      // Merge cached and fetched results
      for (const { orderNumber, katanaOrder } of results) {
        cachedResults.set(orderNumber, katanaOrder);
      }
      
      return cachedResults;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error("Error in batchGetKatanaOrders:", error);
      return new Map();
    }
  }

  // OPTIMIZATION 1: Batch fetch serial numbers for multiple rows in parallel
  async batchGetSerialNumbersForRows(rowIds) {
    try {
      const fetchPromises = rowIds.map(async (rowId) => {
        try {
          const serialNumbers = await this.getSerialNumbersForRow(rowId);
          return { rowId, serialNumbers };
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          console.error(`Error fetching serial numbers for row ${rowId}:`, error);
          return { rowId, serialNumbers: [] };
        }
      });
      
      const results = await Promise.all(fetchPromises);
      const serialNumberMap = new Map();
      
      for (const { rowId, serialNumbers } of results) {
        serialNumberMap.set(rowId, serialNumbers);
      }
      
      return serialNumberMap;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error("Error in batchGetSerialNumbersForRows:", error);
      return new Map();
    }
  }

  // OPTIMIZATION 1: Batch version that fetches all serial numbers in parallel for multiple orders
  async batchGetSerialNumbers(orders) {
    try {
      // Separate cached and uncached orders
      const uncachedOrders = [];
      const cachedResults = new Map();
      
      for (const order of orders) {
        if (this.serialNumberCache && this.serialNumberCache.has(order.number) && this.isCacheValid(order.number, 'serialCache')) {
          cachedResults.set(order.number, this.serialNumberCache.get(order.number));
        } else {
          uncachedOrders.push(order);
        }
      }
      
      if (uncachedOrders.length === 0) {
        return cachedResults;
      }
      
      // Step 0: Check sales export data for orders <= 19769 BEFORE trying Katana API
      const ordersToCheckSalesExport = [];
      const ordersToCheckKatana = [];
      
      // Ensure sales export data is loaded
      if (!this.salesExportDataLoaded) {
        // Wait for background load if in progress, or start new load
        if (this._salesDataLoadingPromise) {
          await this._salesDataLoadingPromise;
        } else {
          await this.loadSalesExportData();
        }
      }
      
      for (const order of uncachedOrders) {
        const orderNumber = parseInt(order.number);
        if (!isNaN(orderNumber) && orderNumber <= 19769) {
          ordersToCheckSalesExport.push(order);
        } else {
          ordersToCheckKatana.push(order);
        }
      }
      
      // Check sales export data for eligible orders
      for (const order of ordersToCheckSalesExport) {
        const salesData = this.getSalesExportData(order.number);
        if (salesData && salesData.serialNumbers && salesData.serialNumbers.length > 0) {
          console.log(`✅ Found ${salesData.serialNumbers.length} serial numbers from sales export data for order #${order.number}`);
          
          // Format: Serial numbers, and Keys if available
          let result = salesData.serialNumbers.join(', ');
          if (salesData.keys && salesData.keys.length > 0) {
            result += ` (Keys: ${salesData.keys.join(', ')})`;
          }
          
          // Cache the result
          this.serialNumberCache.set(order.number, result);
          this.setCacheExpiry(order.number, 'serialCache');
          cachedResults.set(order.number, result);
        } else {
          // No sales export data found, fall through to Katana API
          ordersToCheckKatana.push(order);
        }
      }
      
      // If all orders were found in sales export data, return early
      if (ordersToCheckKatana.length === 0) {
        return cachedResults;
      }
      
      // Step 1: Batch fetch all Katana orders in parallel (only for orders not found in sales export)
      const wooOrderNumbers = ordersToCheckKatana.map(o => o.number);
      const katanaOrdersMap = await this.batchGetKatanaOrders(wooOrderNumbers);
      
      // Step 2: Collect all row IDs from all orders
      const rowIdsByOrder = new Map();
      for (const order of uncachedOrders) {
        const katanaOrder = katanaOrdersMap.get(order.number);
        if (katanaOrder && katanaOrder.sales_order_rows && Array.isArray(katanaOrder.sales_order_rows)) {
          const rowIds = katanaOrder.sales_order_rows
            .filter(row => row.id)
            .map(row => row.id);
          rowIdsByOrder.set(order.number, rowIds);
        }
      }
      
      // Step 3: Batch fetch all serial numbers for all rows in parallel
      const allRowIds = Array.from(rowIdsByOrder.values()).flat();
      const serialNumberMap = await this.batchGetSerialNumbersForRows(allRowIds);
      
      // Step 4: Group serial numbers by order (only for orders checked via Katana API)
      for (const order of ordersToCheckKatana) {
        const rowIds = rowIdsByOrder.get(order.number) || [];
        const orderSerialNumbers = [];
        
        for (const rowId of rowIds) {
          const serials = serialNumberMap.get(rowId) || [];
          orderSerialNumbers.push(...serials);
        }
        
        const result = orderSerialNumbers.length > 0 
          ? orderSerialNumbers.join(', ')
          : "N/A";
        
        // Cache the result
        this.serialNumberCache.set(order.number, result);
        this.setCacheExpiry(order.number, 'serialCache');
        cachedResults.set(order.number, result);
      }
      
      return cachedResults;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error('Error in batchGetSerialNumbers:', error);
      // Return cached results even if batch fetch failed
      return cachedResults;
    }
  }

  getTrackingInfo(order) {
    // OPTIMIZATION: Cache tracking info on order object to avoid re-extraction
    if (order._cachedTrackingInfo !== undefined) {
      return order._cachedTrackingInfo;
    }
    
    try {
      // Check order notes first
      if (order.notes && Array.isArray(order.notes)) {
        for (const note of order.notes) {
          const noteContent = note.note || '';
          // OPTIMIZATION: Only log when tracking is found to reduce console noise
          
          // Look for tracking patterns
          const trackingMatch = this.extractTrackingFromText(noteContent);
          if (trackingMatch) {
            console.log(`Found tracking number: ${trackingMatch.number}`);
            // Cache the result
            order._cachedTrackingInfo = trackingMatch;
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
              // Cache the result
              order._cachedTrackingInfo = trackingMatch;
              return trackingMatch;
            }
          }
        }
      }
      
      // Cache null result to avoid re-checking
      order._cachedTrackingInfo = null;

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
      const version = this.isMissiveEnvironment ? 'vJS5.06' : 'vJS5.06 DEV';
      versionBadge.textContent = version;
      console.log(`Version updated to: ${version}`);
    }
  }

  // Legacy Missive event listeners removed - now handled by JS API integration

  // Legacy fallback auto-search methods removed - now handled by JS API integration

  // Legacy tryGetCurrentEmail method removed - now handled by JS API integration

  // Legacy Missive event handlers removed - now handled by JS API integration

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
      console.log("🔍 Received array of data, cannot extract email directly from array");
      console.log("🔍 Array contents:", data);
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

    // Missive-specific message structure (from documentation)
    if (data.from_field && data.from_field.address) {
      console.log("✅ Found email in data.from_field.address:", data.from_field.address);
      if (this.isValidEmailForSearch(data.from_field.address)) {
        return data.from_field.address;
      }
    }
    
    if (data.to_fields && Array.isArray(data.to_fields)) {
      console.log("✅ Found to_fields array:", data.to_fields);
      for (const recipient of data.to_fields) {
        if (recipient.address && this.isValidEmailForSearch(recipient.address)) {
          console.log("✅ Found valid email in to_fields:", recipient.address);
          return recipient.address;
        }
      }
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
    
    // Check messages array for Missive message structure and body content
    if (Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        // Check Missive-specific message structure first
        if (msg.from_field && msg.from_field.address) {
          console.log("✅ Found email in message.from_field.address:", msg.from_field.address);
          if (this.isValidEmailForSearch(msg.from_field.address)) {
            return msg.from_field.address;
          }
        }
        
        if (msg.to_fields && Array.isArray(msg.to_fields)) {
          console.log("✅ Found message.to_fields array:", msg.to_fields);
          for (const recipient of msg.to_fields) {
            if (recipient.address && this.isValidEmailForSearch(recipient.address)) {
              console.log("✅ Found valid email in message.to_fields:", recipient.address);
              return recipient.address;
            }
          }
        }
        
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

    // Enhanced final fallback: search through ALL properties recursively for email patterns
    console.log("🔍 Enhanced final fallback: searching ALL properties recursively for emails...");
    const foundEmails = this.searchForEmailsRecursively(data, 'data');
    
    if (foundEmails.length > 0) {
      console.log("🔍 Found emails in data:", foundEmails);
      // Return the first valid email
      for (const email of foundEmails) {
        if (this.isValidEmailForSearch(email)) {
          console.log(`✅ Found valid email:`, email);
          return email;
        }
      }
      console.log("❌ Found emails but none are valid for search:", foundEmails);
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

  searchForEmailsRecursively(obj, path = 'root', maxDepth = 5, currentDepth = 0) {
    const emails = [];
    
    if (currentDepth >= maxDepth) {
      console.log(`🔍 Max depth reached at ${path}`);
      return emails;
    }
    
    if (!obj || typeof obj !== 'object') {
      return emails;
    }
    
    try {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = `${path}.${key}`;
        
        if (typeof value === 'string') {
          // Check if string contains @ symbol
          if (value.includes('@')) {
            console.log(`🔍 Found string with @ in ${currentPath}:`, value);
            const extractedEmails = this.extractAllEmailsFromString(value);
            emails.push(...extractedEmails);
            console.log(`🔍 Extracted emails from ${currentPath}:`, extractedEmails);
          }
        } else if (Array.isArray(value)) {
          // Recursively search array items
          for (let i = 0; i < value.length; i++) {
            const arrayEmails = this.searchForEmailsRecursively(value[i], `${currentPath}[${i}]`, maxDepth, currentDepth + 1);
            emails.push(...arrayEmails);
          }
        } else if (value && typeof value === 'object') {
          // Recursively search object properties
          const objectEmails = this.searchForEmailsRecursively(value, currentPath, maxDepth, currentDepth + 1);
          emails.push(...objectEmails);
        }
      }
    } catch (error) {
      console.log(`🔍 Error searching ${path}:`, error.message);
    }
    
    return emails;
  }

  extractAllEmailsFromString(text) {
    if (!text) return [];
    
    // More comprehensive email regex that handles various formats
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex);
    
    if (!matches || matches.length === 0) return [];
    
    // Return all found emails
    return matches;
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

  // Process a single clicked conversation - fetch and cache data
  async processClickedConversation(conversationId) {
    if (!Missive || !Missive.fetchConversations) {
      console.log("⚠️ Missive.fetchConversations not available");
      return;
    }

    // Check if already processed and cached
    const cached = this.recentlyOpenedConversations.get(conversationId);
    if (cached && cached.processed) {
      console.log(`✅ Conversation ${conversationId} already processed`);
      if (cached.email && this.isValidEmailForSearch(cached.email)) {
        this.performAutoSearch(cached.email);
      }
      return;
    }

    try {
      // OPTIMIZATION: Mark as processing to prevent duplicate handling
      this.processingConversationId = conversationId;
      
      console.log(`📧 Processing clicked conversation: ${conversationId}`);
      
      // Fetch the single conversation
      const fetchedConversations = await Missive.fetchConversations([conversationId]);
      
      if (!Array.isArray(fetchedConversations) || fetchedConversations.length === 0) {
        console.log(`⚠️ No conversation data returned for ${conversationId}`);
        return;
      }

      const conversation = fetchedConversations[0];
      
      // Extract email from conversation
      const email = this.extractEmailFromData(conversation);
      if (!email || !this.isValidEmailForSearch(email)) {
        console.log(`⚠️ No valid email found in conversation ${conversationId}`);
        // Still cache the conversation ID to avoid re-processing
        this.updateRecentlyOpenedCache(conversationId, null, false);
        return;
      }

      const normalizedEmail = this.normalizeEmail(email);
      console.log(`📧 Extracted email from conversation: ${email} (normalized: ${normalizedEmail})`);

      // Check if email data is already cached
      if (this.emailCache && this.emailCache.has(normalizedEmail) && this.isCacheValid(normalizedEmail, 'emailCache')) {
        console.log(`✅ Email ${normalizedEmail} already cached, using cached data`);
        this.updateRecentlyOpenedCache(conversationId, normalizedEmail, true);
        this.performAutoSearch(email);
        return;
      }

      // Mark as being processed
      this.updateRecentlyOpenedCache(conversationId, normalizedEmail, false);

      // Show searching status immediately when user clicks on email
      this.setStatus("Searching orders...");

      // Search for orders
      await this.searchOrdersByEmail(email);
      
      // OPTIMIZATION: Display basic order info immediately if orders found
      // This gives user instant feedback while we load additional details in background
      if (this.allOrders.length > 0) {
        // Display orders immediately with basic info (shows "Loading..." for serial/tracking)
        this.displayOrdersList();
        
        // Then load additional details in background (non-blocking)
        // This allows the UI to be responsive while data loads
        this.loadOrderDetails(this.allOrders).then(() => {
          // Update cache with enhanced orders (includes notes, Katana data, serial numbers)
          if (this.emailCache) {
            this.emailCache.set(normalizedEmail, [...this.allOrders]);
            this.setCacheExpiry(normalizedEmail, 'emailCache');
            this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
          }
          // Update UI with enhanced data (tracking numbers, serial numbers, etc.)
          // Instead of re-rendering entire list, just update the cells that changed
          this.updateOrderDetailsUI(this.allOrders);
        }).catch(error => {
          console.error(`❌ Error loading additional details:`, error);
          // Still cache basic orders even if details fail
          if (this.emailCache) {
            this.emailCache.set(normalizedEmail, [...this.allOrders]);
            this.setCacheExpiry(normalizedEmail, 'emailCache');
            this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
          }
        });
      } else {
        // No orders found, but cache empty result to avoid re-searching
        if (this.emailCache) {
          this.emailCache.set(normalizedEmail, []);
          this.setCacheExpiry(normalizedEmail, 'emailCache');
          this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
        }
      }
      
      // Mark as processed
      this.updateRecentlyOpenedCache(conversationId, normalizedEmail, true);
      
      // Clear processing flag
      this.processingConversationId = null;
      
      console.log(`✅ Completed processing conversation ${conversationId} for email ${normalizedEmail}`);
    } catch (error) {
      console.error(`❌ Error processing conversation ${conversationId}:`, error);
      // Remove from cache on error so it can be retried
      this.recentlyOpenedConversations.delete(conversationId);
      // Clear processing flag on error
      if (this.processingConversationId === conversationId) {
        this.processingConversationId = null;
      }
    }
  }

  // Update LRU cache for recently opened conversations (max 15)
  updateRecentlyOpenedCache(conversationId, email, processed) {
    // If cache is full, remove oldest entry (LRU)
    if (this.recentlyOpenedConversations.size >= this.maxRecentlyOpenedConversations) {
      // Find oldest entry by timestamp
      let oldestId = null;
      let oldestTimestamp = Infinity;
      
      for (const [id, data] of this.recentlyOpenedConversations.entries()) {
        if (data.timestamp < oldestTimestamp) {
          oldestTimestamp = data.timestamp;
          oldestId = id;
        }
      }
      
      if (oldestId) {
        console.log(`🗑️ Removing oldest conversation from cache: ${oldestId}`);
        this.recentlyOpenedConversations.delete(oldestId);
      }
    }

    // Add/update current conversation
    this.recentlyOpenedConversations.set(conversationId, {
      email: email,
      timestamp: Date.now(),
      processed: processed
    });
    
    console.log(`💾 Cached conversation ${conversationId} (${this.recentlyOpenedConversations.size}/${this.maxRecentlyOpenedConversations} cached)`);
  }

  // Normalize email for consistent cache lookups (lowercase, trimmed)
  normalizeEmail(email) {
    if (!email || typeof email !== 'string') return null;
    return email.trim().toLowerCase();
  }

  // Load all customer details: order notes, Katana orders, and serial numbers
  async loadOrderDetails(orders) {
    if (!orders || orders.length === 0) {
      return;
    }

    try {
      console.log(`📦 Loading details for ${orders.length} orders...`);
      
      // Step 1: Fetch order notes in parallel for all orders
      const notesPromises = orders.map(async (order) => {
        try {
          // Only fetch if notes are not already present
          if (!order.notes || order.notes.length === 0) {
            const notesUrl = this.getAuthenticatedUrl(`/orders/${order.id}/notes`);
            order.notes = await this.makeRequest(notesUrl);
            console.log(`✅ Loaded ${order.notes?.length || 0} notes for order #${order.number}`);
          }
        } catch (error) {
          console.error(`❌ Failed to load notes for order ${order.id}:`, error);
          order.notes = [];
        }
      });
      
      await Promise.all(notesPromises);
      
      // Step 2: Batch fetch Katana orders for all WooCommerce orders
      const wooOrderNumbers = orders.map(o => o.number);
      await this.batchGetKatanaOrders(wooOrderNumbers);
      console.log(`✅ Loaded Katana orders for ${orders.length} WooCommerce orders`);
      
      // Step 3: Batch fetch serial numbers for all orders
      await this.batchGetSerialNumbers(orders);
      console.log(`✅ Loaded serial numbers for ${orders.length} orders`);
      
      console.log(`✅ Completed loading all details for ${orders.length} orders`);
    } catch (error) {
      console.error(`❌ Error loading order details:`, error);
      // Don't throw - allow partial loading to complete
    }
  }

  // Unified cache lookup - checks emailCache for cached orders
  // Returns cached orders array if found, null otherwise
  getCachedOrdersData(normalizedEmail) {
    if (!normalizedEmail) return null;
    
    // Check emailCache (primary and only cache)
    if (this.emailCache?.has(normalizedEmail) && this.isCacheValid(normalizedEmail, 'emailCache')) {
      const cached = this.emailCache.get(normalizedEmail);
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    }
    
    return null;
  }

  // Auto-search triggered when user clicks on a conversation/email
  async performAutoSearch(email) {
    if (!email || !this.isValidEmailForSearch(email)) {
      // console.log("❌ Invalid email for search:", email);
      return;
    }

    // OPTIMIZATION: Normalize email for consistent cache lookups
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      console.log("❌ Failed to normalize email:", email);
      return;
    }

    // OPTIMIZATION 4: Cancel any previous search requests
    if (this.activeSearchAbortController) {
      console.log("Cancelling previous search requests");
      this.activeSearchAbortController.abort();
    }
    // Create new AbortController for this search
    this.activeSearchAbortController = new AbortController();

    // Check if we're already searching this email (use normalized email)
    if (this.searchInProgress && this.activeSearches.has(normalizedEmail)) {
      console.log(`⏳ Already searching for ${normalizedEmail}, skipping`);
      return;
    }

    // Always clear the display first when switching emails
    this.clearCurrentEmailData();

    // OPTIMIZATION: Unified cache lookup
    console.log(`🔍 Checking cache for email: ${normalizedEmail} (original: ${email})`);
    const cachedOrders = this.getCachedOrdersData(normalizedEmail);
    if (cachedOrders) {
      console.log(`✅ Found cached data for ${normalizedEmail}: ${cachedOrders.length} orders`);
      this.allOrders = cachedOrders;
      this.displayOrdersList();
      return;
    } else {
      console.log(`⚠️ Cache miss: Email ${normalizedEmail} not in cache or expired`);
    }

    // Only proceed with API search if cache check failed
    console.log(`⚠️ No cached data found for ${normalizedEmail}, performing API search...`);
    // Set search in progress (use normalized email for tracking)
    this.searchInProgress = true;
    this.activeSearches.set(normalizedEmail, true);
    
    // Debounce API calls (but not cache checks)
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(async () => {
      try {
        // Show searching status (only when actually searching API)
        this.setStatus("Searching orders...");
        
        // Use original email for API search (WooCommerce may need original format)
        // but use normalized email for cache storage
        console.log(`🔍 Starting API search for: ${email} (normalized: ${normalizedEmail})`);
        const orderResults = await this.searchWooCommerceOrders(email);
        
        // OPTIMIZATION 4: Check if search was cancelled
        if (this.activeSearchAbortController?.signal.aborted) {
          console.log("Search was cancelled, ignoring results");
          return;
        }
        
        if (Array.isArray(orderResults)) {
          // console.log(`DEBUG: performAutoSearch - Before allOrders assignment. Received orderResults.length: ${orderResults ? orderResults.length : 'null/undefined'}. Current allOrders.length: ${this.allOrders.length}`);
          this.allOrders = orderResults; // No need to clone
          // console.log(`DEBUG: performAutoSearch - After allOrders assignment. New allOrders.length: ${this.allOrders.length}`);
          // console.log(`DEBUG: performAutoSearch - Calling displayOrdersList for ${email}. allOrders.length: ${this.allOrders.length}`);
          this.displayOrdersList();
          // Status is already set by displayOrdersList (handles both found and not found cases), no need to set again
        } else {
          // console.log("❌ Invalid order results:", orderResults);
          this.setStatus("No orders found");
        }
        
      } catch (error) {
        // Don't log abort errors as errors
        if (error.name === 'AbortError' || error.message === 'Search cancelled') {
          console.log("Search cancelled");
          return;
        }
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
    
    // Don't set status here - let performAutoSearch handle status messages
    // This prevents showing "Switching emails..." when data is already cached
    
    console.log("✅ Current email data cleared");
  }

  cleanup() {
    // This method is called ONLY when user navigates away (via beforeunload event)
    // All caches are cleared at this point to free memory
    // During the session, cache persists to ensure positive search results remain available
    
    // Clear timers
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    
    // Clear conversation change debounce timer
    if (this.conversationChangeDebounceTimer) {
      clearTimeout(this.conversationChangeDebounceTimer);
      this.conversationChangeDebounceTimer = null;
    }
    
    // Clear cache (only on navigation away)
    this.emailCache.clear();
    if (this.visibleEmails) {
    this.visibleEmails.clear();
    }
    
    // Clear conversation cache
    
    // Clear performance caches
    this.katanaOrderCache = {};
    this.serialNumberCache = {};
    
    // Remove event listeners using stored bound references
    // Fix: Use stored bound function references instead of creating new ones
    if (this.boundSearchBtnA) {
      this.boundSearchBtnA.removeEventListener("click", this.boundHandleSearch);
    }
    if (this.boundSearchBtnB) {
      this.boundSearchBtnB.removeEventListener("click", this.boundHandleSearch);
    }
    
    // Remove keypress handlers using stored references
    if (this.boundSearchInputA) {
      const handlerA = this.boundKeyPressHandlers.get(this.boundSearchInputA);
      if (handlerA) {
        this.boundSearchInputA.removeEventListener("keypress", handlerA);
      }
    }
    if (this.boundSearchInputB) {
      const handlerB = this.boundKeyPressHandlers.get(this.boundSearchInputB);
      if (handlerB) {
        this.boundSearchInputB.removeEventListener("keypress", handlerB);
      }
    }
    
    // Also try to remove from elements that might exist but weren't stored
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("orderSearch");
    if (searchBtn && this.boundHandleSearch) {
      searchBtn.removeEventListener("click", this.boundHandleSearch);
    }
    if (searchInput) {
      const handler = this.boundKeyPressHandlers.get(searchInput);
      if (handler) {
        searchInput.removeEventListener("keypress", handler);
      }
    }
    
    // Clear stored references
    this.boundKeyPressHandlers.clear();
    
    console.log("Cleanup completed");
  }

  clearCaches() {
    // NOTE: This method should ONLY be called when user navigates away
    // Cache persists during the session to ensure positive search results remain available
    // Called automatically by cleanup() on beforeunload event
    console.log('Clearing all performance caches...');
    this.katanaOrderCache = {};
    this.serialNumberCache = {};
    this.emailCache.clear();
    this.cacheExpiry.clear();
    this.recentlyOpenedConversations.clear();
    console.log('Performance caches cleared');
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

  // OPTIMIZATION: Enforce cache size limits using LRU eviction
  enforceCacheSizeLimit(cache, cacheType, maxSize) {
    if (!cache || cache.size <= maxSize) {
      return;
    }

    // Get all entries with their expiry times to determine LRU
    const entries = Array.from(cache.entries()).map(([key, value]) => {
      const expiryKey = `${cacheType}-${key}`;
      const expiryTime = this.cacheExpiry.get(expiryKey) || 0;
      return { key, value, expiryTime };
    });

    // Sort by expiry time (oldest first - LRU)
    entries.sort((a, b) => a.expiryTime - b.expiryTime);

    // Remove oldest entries until we're under the limit
    const toRemove = entries.slice(0, cache.size - maxSize);
    for (const entry of toRemove) {
      cache.delete(entry.key);
      const expiryKey = `${cacheType}-${entry.key}`;
      this.cacheExpiry.delete(expiryKey);
      console.log(`🗑️ Evicted ${entry.key} from ${cacheType} cache (LRU)`);
    }
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