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
        maxCacheSize: 100, // Maximum number of entries in emailCache
        maxKatanaCacheSize: 200, // Maximum number of entries in katanaOrderCache
        maxSerialCacheSize: 200 // Maximum number of entries in serialNumberCache
      };
      
      // Search state management
      this.allOrders = [];
      this.lastSearchedEmail = null;
      this.activeDisplayEmail = null; // Track which email's data is currently displayed (prevents race conditions)
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

  /**
   * Subscribe directly to the documented `change:conversations` event.
   *
   * Previously this method bailed out whenever `isMissiveEnvironment` was
   * true, on the assumption that `integrations/missive-js/app.js` (the
   * bridge) would do the wiring. In production that always-true short-
   * circuit meant the listener was *only* bound by the bridge — and the
   * 300ms debounce wrapper in this method was permanently dead code.
   *
   * As of vJS5.32 the bridge no longer wraps `Missive.on`; the app owns
   * the subscription directly. This collapses the previous two-layer
   * architecture (bridge listens → bridge forwards → app handles) into
   * a single layer (app listens → app handles), removing a class of
   * "which file owns this?" debugging cycles.
   *
   * The vJS5.25 length-1 guard in `handleConversationChange` plus the
   * existing dedup-by-ID checks (`processingConversationId`,
   * `lastConversationId`) make the old debounce wrapper unnecessary —
   * Missive doesn't fire `change:conversations` rapidly enough on a
   * length-1-gated handler to need additional throttling.
   */
  setupMissiveEventListeners() {
    console.log("🔧 Setting up Missive event listeners...");

    if (!window.Missive || typeof Missive.on !== 'function') {
      console.log("ℹ️ Missive.on unavailable - skipping listener (web/dev mode)");
      return;
    }

    try {
      Missive.on('change:conversations', (ids) => this.handleConversationChange(ids));
      console.log("✅ change:conversations listener bound");
    } catch (error) {
      console.error("❌ Failed to bind change:conversations listener:", error);
    }
  }

  // Removed tryGetCurrentContext - events handle conversation changes automatically

  async handleConversationChange(data) {
    console.log("📧 Handling conversation change:", data);
    
    try {
      // Check if data is an array of conversation IDs (from change:conversations event)
      // The first ID in the array is the currently clicked/opened conversation
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
        // Only act on a single-conversation focus. The Missive doc treats
        // change:conversations as a *selection-changed* signal, not a click
        // event — the array reflects the user's current selection in the
        // inbox, which can be 0 (deselected), 1 (one conversation in focus),
        // or N (shift/cmd-click batch operations like bulk labeling). Only
        // length === 1 is unambiguously "look up this customer's orders";
        // multi-select would otherwise spawn a full WooCommerce + Katana +
        // serial-number pipeline against an arbitrary data[0] from a batch
        // the user never asked us to look at.
        if (data.length !== 1) {
          console.log(`ℹ️ Ignoring change:conversations with ${data.length} ids (multi-select / deselect)`);
          return;
        }

        const clickedConversationId = data[0];
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
            this.performAutoSearch(cached.email, { clearSearchInput: true });
          }
          return;
        }
        
        // OPTIMIZATION: Process immediately for click-triggered conversations (no debounce delay)
        // Clear any pending debounce timer
        if (this.conversationChangeDebounceTimer) {
          clearTimeout(this.conversationChangeDebounceTimer);
          this.conversationChangeDebounceTimer = null;
        }
        
        // Process immediately - duplicate protection already handled above
          this.lastConversationId = null; // Clear after processing starts
          await this.processClickedConversation(clickedConversationId);
        
        return;
      }
      
      // Handle single conversation object (backward compatibility)
      const email = this.extractEmailFromData(data);
      if (email && this.isValidEmailForSearch(email)) {
        console.log("✅ Extracted email from conversation:", email);
        this.performAutoSearch(email, { clearSearchInput: true });
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
    return 'vJS5.32';
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
    
    // OPTIMIZATION: Removed fallback timers - they were causing unnecessary CPU usage
    // Loading state is now properly managed by search operations and displayOrdersList()
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

    // CRITICAL: Reset activeDisplayEmail so displayOrdersList() doesn't drop
    // these (legitimate, user-initiated) results as "stale" because the
    // previously-rendered conversation auto-search left activeDisplayEmail
    // pointed at a different address. processClickedConversation and
    // performAutoSearch already do this; handleSearch was missing the reset
    // and the staleness guard silently swallowed manual-search renders.
    this.activeDisplayEmail = null;

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
      
      // Set active display email before displaying
      const currentNormalizedEmail = this.lastSearchedEmail ? this.normalizeEmail(this.lastSearchedEmail) : null;
      this.activeDisplayEmail = currentNormalizedEmail;
      
      // Display orders immediately with basic info (shows "Loading..." for serial/tracking)
      await this.displayOrdersList();
      
      // Store the email this loadOrderDetails call is for (to prevent race conditions)
      const detailsForEmail = this.lastSearchedEmail ? this.normalizeEmail(this.lastSearchedEmail) : null;
      const detailsForOrders = [...this.allOrders]; // Clone orders array
      
      // Then load additional details in background (non-blocking)
      // This allows the UI to be responsive while data loads
      // OPTIMIZATION: Pass email to check if conversation is still active
      this.loadOrderDetails(detailsForOrders, detailsForEmail).then(() => {
        // CRITICAL: Only update UI if this email is still the current one
        // Prevents race condition where user clicks another email while details are loading
        if (detailsForEmail) {
          const currentNormalizedEmail = this.lastSearchedEmail ? this.normalizeEmail(this.lastSearchedEmail) : null;
          if (currentNormalizedEmail !== detailsForEmail || this.activeDisplayEmail !== detailsForEmail) {
            console.log(`⚠️ Skipping UI update - email changed from ${detailsForEmail} to ${currentNormalizedEmail}`);
            return;
          }
        }
        
        // Update allOrders with enhanced data
        this.allOrders = detailsForOrders;
        
        // Update UI with enhanced data (tracking numbers, serial numbers, etc.)
        // Instead of re-rendering entire list, just update the cells that changed
        this.updateOrderDetailsUI(detailsForOrders);
      }).catch(error => {
        // Don't log errors if conversation was closed (expected behavior)
        if (error.message === 'Conversation closed') {
          console.log(`⚠️ Background loading stopped - conversation closed for ${detailsForEmail || 'order'}`);
          return;
        }
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
    
    // Set up a hard timeout to prevent indefinite spinning. WooCommerce's
    // REST `?search=` parameter does a fuzzy text scan across multiple
    // billing/customer columns and can take 20-30+ seconds on large catalogs,
    // so a 12s budget was too aggressive and produced false "No orders found"
    // states (see vJS5.30 changelog). 30s matches performAutoSearch (vJS5.32).
    const SEARCH_TIMEOUT_MS = 30000;
    let timeoutId = null;

    if (!this.activeSearchAbortController) {
      this.activeSearchAbortController = new AbortController();
    }

    timeoutId = setTimeout(() => {
      if (this.activeSearchAbortController && !this.activeSearchAbortController.signal.aborted) {
        console.log(`⏱️ Search timeout reached (${SEARCH_TIMEOUT_MS / 1000}s), cancelling request`);
        this.activeSearchAbortController.abort();

        // Timeout is NOT equivalent to "no orders" - the API never finished.
        // Surface an explicit timeout status instead of a misleading empty
        // result so users can retry without thinking the customer has no orders.
        this.setStatus(
          "Search timed out. Please retry or search by order number or email.",
          'error'
        );
        this.hideLoading();
        this.activeSearchAbortController = null;
      }
    }, SEARCH_TIMEOUT_MS);
    
    try {
      // Search WooCommerce orders only
      const orderResults = await this.searchWooCommerceOrders(email);
      
      // Clear timeout since search completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
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
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
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
    
    // Cache the results with expiration (unified caching)
    // Note: Don't set this.allOrders here - it will be set by the caller after displayOrdersList is called
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
      // CRITICAL: Check if this data is still relevant to the current active email
      // This prevents race conditions where old search results overwrite new ones
      const currentNormalizedEmail = this.lastSearchedEmail ? this.normalizeEmail(this.lastSearchedEmail) : null;
      // Only skip if we have an active display email set AND it doesn't match the current email
      // If activeDisplayEmail is null, that means we're starting fresh, so allow the display
      if (this.activeDisplayEmail !== null && currentNormalizedEmail !== null && this.activeDisplayEmail !== currentNormalizedEmail) {
        console.log(`⚠️ Skipping display - email changed from ${this.activeDisplayEmail} to ${currentNormalizedEmail}`);
        this._displayInProgress = false; // Reset flag before returning
        return;
      }
      
      // Ensure allOrders is always an array
      if (!Array.isArray(this.allOrders)) {
        this.allOrders = [];
      }
      
      if (this.allOrders.length === 0) {
        // CRITICAL: Clear results container to prevent showing stale data
        const resultsContainer = document.getElementById("results");
        if (resultsContainer) {
          resultsContainer.innerHTML = "";
        }
        this.hideLoading();
        // console.log("DEBUG: displayOrdersList - No orders in allOrders, setting 'No orders found'.");
        this.setStatus("No orders found");
        // Update active display email even for empty results
        this.activeDisplayEmail = currentNormalizedEmail;
        return;
      }
  
      // Set correct status when orders are found
      this.setStatus(`Found ${this.allOrders.length} order(s)`);
      // console.log(`DEBUG: displayOrdersList - Setting status to 'Found ${this.allOrders.length} order(s)'.`);
      
      // Update active display email to match current search
      this.activeDisplayEmail = currentNormalizedEmail;

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
      
      // Initial render: notes may or may not be loaded yet. The helper
      // treats "no tracking found" as transient ("Loading...") here and
      // as terminal ("Not Shipped Yet") in updateOrderDetailsUI() below.
      // Non-completed orders skip the wait entirely and render the
      // terminal "Not Shipped Yet" state immediately.
      const trackingCell = document.getElementById(`tracking-${order.id}`);
      const notesFetched = Array.isArray(order.notes) && order.notes.length > 0;
      this.renderTrackingCell(trackingCell, order, notesFetched);
    }
    } finally {
      this._displayInProgress = false;
      // console.log("DEBUG: displayOrdersList finished. _displayInProgress set to false.");
    }
  }

  /**
   * Render the contents of a single tracking cell.
   *
   * Single source of truth for the three UI states the tracking column
   * can be in. Both displayOrdersList() and updateOrderDetailsUI()
   * delegate here so the rendering logic stays consistent.
   *
   * States:
   *   1. Tracking info successfully resolved          -> carrier link
   *   2. Notes fetched, no tracking found             -> "Not Shipped Yet" (terminal)
   *   3. Notes still being fetched                    -> "Loading..." (transient)
   *
   * Tracking-data presence is the sole criterion. Earlier revisions
   * also short-circuited on `order.status !== 'completed'`, but in
   * QuikrStuff's actual fulfillment flow shipped orders sit at
   * `processing` with the tracking note added — they never reach
   * `completed` until WooCommerce's auto-complete fires (or never).
   * Status-based gating made every order render as "Not Shipped Yet".
   *
   * @param {HTMLElement|null} cell        The <td> to populate.
   * @param {object} order                 The order under render.
   * @param {boolean} notesFetched         True once async note loading
   *                                       has run for this order — i.e.
   *                                       the absence of tracking is now
   *                                       a terminal answer rather than
   *                                       a "still loading" state.
   */
  renderTrackingCell(cell, order, notesFetched) {
    if (!cell || !order) return;

    const trackingInfo = this.getTrackingInfo(order);
    if (trackingInfo) {
      const link = document.createElement('a');
      link.href = trackingInfo.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = trackingInfo.number;
      cell.innerHTML = '';
      cell.appendChild(link);
      return;
    }

    cell.textContent = notesFetched ? 'Not Shipped Yet' : 'Loading...';
  }

  // Update order details UI after loadOrderDetails completes (avoids re-rendering entire list)
  updateOrderDetailsUI(orders) {
    if (!orders || orders.length === 0) return;
    
    // CRITICAL: Check if this update is still relevant to the current active email
    // This prevents race conditions where background loading completes after user navigated away
    const currentNormalizedEmail = this.lastSearchedEmail ? this.normalizeEmail(this.lastSearchedEmail) : null;
    if (this.activeDisplayEmail !== null && this.activeDisplayEmail !== currentNormalizedEmail) {
      console.log(`⚠️ Skipping updateOrderDetailsUI - email changed from ${this.activeDisplayEmail} to ${currentNormalizedEmail}`);
      return;
    }
    
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
      
      // Post-fetch render: notes have been loaded for completed orders,
      // so absence of tracking is now a terminal "Not Shipped Yet" state
      // rather than transient "Loading...". The helper handles the full
      // state matrix; we just signal that notes have been fetched.
      const trackingCell = document.getElementById(`tracking-${order.id}`);
      this.renderTrackingCell(trackingCell, order, true);
    }
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

  /**
   * Read persisted data from Missive storage when available, otherwise localStorage.
   * This keeps web/dev mode functional while enabling cross-session Missive caching.
   */
  async getPersistentValue(key) {
    if (this.isMissiveEnvironment && window.Missive && typeof Missive.storeGet === 'function') {
      return await Missive.storeGet(key);
    }

    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    try {
      return JSON.parse(raw);
    } catch (_err) {
      return raw;
    }
  }

  /**
   * Write persisted data to Missive storage when available, otherwise localStorage.
   */
  async setPersistentValue(key, value) {
    if (this.isMissiveEnvironment && window.Missive && typeof Missive.storeSet === 'function') {
      await Missive.storeSet(key, value);
      return;
    }

    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Remove persisted data from Missive storage when available, otherwise localStorage.
   */
  async removePersistentValue(key) {
    if (this.isMissiveEnvironment && window.Missive && typeof Missive.storeSet === 'function') {
      await Missive.storeSet(key, null);
      return;
    }

    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
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
      
      // Check persisted cache first (Missive store in integration mode; localStorage fallback in web/dev)
      try {
        const cached = await this.getPersistentValue(cacheKey);
        const cachedTimestamp = await this.getPersistentValue(cacheTimestampKey);
        
        if (cached && cachedTimestamp) {
          const parsedTimestamp = Number(cachedTimestamp);
          const age = Date.now() - parsedTimestamp;
          if (age < CACHE_TTL) {
            const cachedData = typeof cached === 'string' ? JSON.parse(cached) : cached;
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
            await this.removePersistentValue(cacheKey);
            await this.removePersistentValue(cacheTimestampKey);
          }
        }
      } catch (e) {
        console.warn('⚠️ Cache read failed, will fetch fresh:', e);
        await this.removePersistentValue(cacheKey);
        await this.removePersistentValue(cacheTimestampKey);
      }
      
      // Use Web Worker to parse JSON in background (doesn't block UI)
      if (typeof Worker !== 'undefined') {
        try {
          const worker = new Worker('worker/parse-sales-worker.js');
          const parsePromise = new Promise((resolve, reject) => {
            worker.onmessage = async (msg) => {
              const data = msg.data;
              if (data && data.success) {
                // Restore the Map from worker result
                for (const [orderNo, record] of Object.entries(data.idMap || {})) {
                  this.salesExportData.set(orderNo, record);
                }
                
                // Cache the parsed index
                try {
                  await this.setPersistentValue(cacheKey, { idMap: data.idMap });
                  await this.setPersistentValue(cacheTimestampKey, Date.now());
                } catch (e) {
                  console.warn('⚠️ Could not cache order index:', e);
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
            await this.setPersistentValue(cacheKey, { idMap });
            await this.setPersistentValue(cacheTimestampKey, Date.now());
          } catch (e) {
            console.warn('⚠️ Could not cache order index:', e);
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
            this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
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
        this.setCacheExpiry(order.number, 'serialCache');
        this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
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
        this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
        return result;
      } else {
        console.log(`No serial numbers found for order #${order.number}`);
        this.serialNumberCache.set(order.number, "N/A");
        this.setCacheExpiry(order.number, 'serialCache');
        this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
        return "N/A";
      }
        } catch (error) {
      console.error('Error getting serial number:', error);
      this.serialNumberCache.set(order.number, "N/A");
      this.setCacheExpiry(order.number, 'serialCache');
      this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
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
          this.enforceCacheSizeLimit(this.katanaOrderCache, 'katanaCache', this.cacheConfig.maxKatanaCacheSize);
          return fullOrder;
        } else {
          console.log(`Could not get full order details, returning basic order`);
          this.katanaOrderCache.set(wooOrderNumber, katanaOrder);
          this.setCacheExpiry(wooOrderNumber, 'katanaCache');
          this.enforceCacheSizeLimit(this.katanaOrderCache, 'katanaCache', this.cacheConfig.maxKatanaCacheSize);
          return katanaOrder;
        }
      } else {
        console.log(`No Katana order found for WooCommerce order #${wooOrderNumber}`);
        this.katanaOrderCache.set(wooOrderNumber, null);
        this.setCacheExpiry(wooOrderNumber, 'katanaCache');
        this.enforceCacheSizeLimit(this.katanaOrderCache, 'katanaCache', this.cacheConfig.maxKatanaCacheSize);
        return null;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Katana order fetch cancelled");
        throw error;
      }
      console.error(`Error fetching Katana order for #${wooOrderNumber}:`, error);
      this.katanaOrderCache.set(wooOrderNumber, null);
      this.setCacheExpiry(wooOrderNumber, 'katanaCache');
      this.enforceCacheSizeLimit(this.katanaOrderCache, 'katanaCache', this.cacheConfig.maxKatanaCacheSize);
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
          this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
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
        this.enforceCacheSizeLimit(this.serialNumberCache, 'serialCache', this.cacheConfig.maxSerialCacheSize);
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

  /**
   * Resolve tracking info for an order, or null when none is available.
   *
   * Tracking-data presence is the sole criterion — if we find a
   * carrier-named pattern in the order notes (or in a tracking-keyed
   * meta value), we return it; otherwise we return null. The UI layer
   * surfaces null as "Not Shipped Yet".
   *
   * Note on order.status: an earlier revision (vJS5.21) gated this
   * function on `order.status === 'completed'` based on a stated
   * convention that QuikrStuff orders move to completed only after
   * shipping. In practice, shipped orders are typically still at
   * `processing` (with the tracking note added), and the `completed`
   * transition either fires later via WooCommerce's auto-complete or
   * not at all. Gating on status caused every order to render as "Not
   * Shipped Yet" — even ones with valid tracking notes. The gate is
   * removed here. False-positive prevention now relies entirely on the
   * tightened regexes in extractTrackingFromText() and on the meta_data
   * scan only inspecting keys that match /track/i.
   *
   * Scan order:
   *   1. `order.notes[].note` for carrier-named tracking patterns.
   *   2. `order.meta_data[]` entries whose KEY contains "track"
   *      (case-insensitive) — covers WC Shipment Tracking, AfterShip,
   *      and similar plugins. Random meta values (billing phone,
   *      transaction IDs, etc.) are not scanned.
   */
  getTrackingInfo(order) {
    if (!order) return null;
    // Positive-only cache. We deliberately do NOT short-circuit on a
    // previously-cached *null* result, because the order's notes are
    // fetched async after the initial render: the first call to this
    // function (from displayOrdersList) runs before notes have loaded
    // and would cache null forever, so updateOrderDetailsUI's later
    // call after the notes arrive would never get to scan them.
    // Caching only truthy results means the worst case is re-running
    // a cheap regex pass on each render — vs. the previous behavior
    // of every order rendering "Not Shipped Yet" because of the
    // poisoned cache.
    if (order._cachedTrackingInfo) {
      return order._cachedTrackingInfo;
    }

    try {
      const orderRef = order.number ?? order.id ?? '?';
      const noteCount = Array.isArray(order.notes) ? order.notes.length : 0;
      const metaCount = Array.isArray(order.meta_data) ? order.meta_data.length : 0;

      if (Array.isArray(order.notes)) {
        for (const note of order.notes) {
          const noteContent = note?.note || '';
          const trackingMatch = this.extractTrackingFromText(noteContent);
          if (trackingMatch) {
            console.log(`✅ Tracking #${orderRef}: ${trackingMatch.number} (${trackingMatch.provider}) [from note]`);
            order._cachedTrackingInfo = trackingMatch;
            return trackingMatch;
          }
        }
      }

      // Restrict meta scan to keys that look tracking-related. Prevents
      // 10-digit billing-phone meta values from being matched as tracking
      // — this is the actual fix for the original "DHL link on unshipped
      // order" bug, since unshipped orders have no notes but DO have
      // meta_data with billing phones / payment intents.
      if (Array.isArray(order.meta_data)) {
        for (const meta of order.meta_data) {
          if (!meta?.key || !meta?.value) continue;
          if (!/track/i.test(meta.key)) continue;
          const trackingMatch = this.extractTrackingFromText(String(meta.value));
          if (trackingMatch) {
            console.log(`✅ Tracking #${orderRef}: ${trackingMatch.number} (${trackingMatch.provider}) [from meta '${meta.key}']`);
            order._cachedTrackingInfo = trackingMatch;
            return trackingMatch;
          }
        }
      }

      // Diagnostic logging when extraction fails on an order that has
      // notes to scan. Surfaces a small content sample so a future
      // failure mode (notes formatted in a way the matcher misses)
      // can be diagnosed from a single user-shared console log without
      // needing a code change to instrument it.
      if (noteCount > 0) {
        const firstNoteText = String(order.notes[0]?.note || '').trim();
        const sample = firstNoteText.slice(0, 200).replace(/\s+/g, ' ');
        console.log(`ℹ️ No tracking match for #${orderRef} (notes=${noteCount}, meta=${metaCount}); first note sample: "${sample}${firstNoteText.length > 200 ? '…' : ''}"`);
      }

      // Intentionally not caching the null result — see top-of-function
      // comment.
      return null;
    } catch (error) {
      console.error('Error getting tracking info:', error);
      return null;
    }
  }

  /**
   * Extract a tracking number + carrier from free-text content.
   *
   * Three-stage matcher (highest precision first):
   *
   *   Stage 1: a carrier name appears alongside a digit run.
   *   e.g. "DHL 1234567890", "USPS: 9400 1234 5678 9012 3456 78".
   *   When this matches, the carrier is unambiguous.
   *
   *   Stage 2: a digit run that *uniquely* identifies a carrier by
   *   shape — USPS `9[234]…{17–22}`, UPS `1Z…{16}`, UPS `T\d{10}`.
   *   These shapes don't collide with phone numbers or generic IDs.
   *
   *   Stage 3: digit runs of carrier-typical length (FedEx `\d{12}`,
   *   FedEx `\d{15}`, DHL `\d{10}`). These DO overlap with non-tracking
   *   numbers (a 10-digit US phone is indistinguishable from a DHL
   *   Express AWB), but in practice WooCommerce order *notes* are
   *   free-text written by fulfillment systems and don't typically
   *   contain customer phone numbers — those live in `meta_data`. We
   *   keep stage 3 because QuikrStuff's tracking notes are commonly
   *   bare 10-digit DHL AWBs without the "DHL" prefix.
   *
   * The original false-positive bug (an unshipped order rendering a
   * "DHL" link from a 10-digit billing phone) is *not* fixed here in
   * the regex; it's fixed at the call site in getTrackingInfo() by
   * restricting `meta_data` scans to keys matching /track/i. So this
   * function intentionally stays permissive for the notes path while
   * the meta_data path stays narrow.
   */
  extractTrackingFromText(text) {
    if (!text) return null;

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
        const url = this.getCarrierTrackingUrl(trackingNumber, pattern.name);
        if (!url) continue;
        return { number: trackingNumber, url, provider: pattern.name };
      }
    }

    // Stage 2 + 3: shape-anchored fallbacks. Order matters — shape-unique
    // patterns (USPS 9[234]…, UPS 1Z…, UPS T+10) come first so they win
    // over the more permissive bare-digit-length patterns below them.
    const fallbackPatterns = [
      { regex: /\b9[234]\d{16,22}\b/, provider: 'USPS' },
      { regex: /\b1Z[A-Z0-9]{16}\b/, provider: 'UPS' },
      { regex: /\bT\d{10}\b/, provider: 'UPS' },
      { regex: /\b\d{12}\b/, provider: 'FedEx' },
      { regex: /\b\d{15}\b/, provider: 'FedEx' },
      { regex: /\b\d{10}\b/, provider: 'DHL' }
    ];

    for (const pattern of fallbackPatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const trackingNumber = match[0];
        const url = this.getCarrierTrackingUrl(trackingNumber, pattern.provider);
        if (!url) continue;
        return { number: trackingNumber, url, provider: pattern.provider };
      }
    }

    return null;
  }

  /**
   * Map a tracking number + provider to a carrier-specific tracking URL.
   * Returns `null` for unknown providers — callers must treat that as
   * "no tracking" rather than guessing a URL. The previous behavior
   * (default to USPS, plus auto-classifying any 10-digit input as DHL)
   * produced false-positive carrier links.
   */
  getCarrierTrackingUrl(trackingNumber, provider = '') {
    if (!trackingNumber) return null;
    const number = String(trackingNumber).trim();
    if (!number) return null;

    switch (provider) {
      case 'USPS':
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
      case 'UPS':
        return `https://www.ups.com/track?tracknum=${number}`;
      case 'FedEx':
        return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
      case 'DHL':
        return `https://www.dhl.com/en/express/tracking.html?AWB=${number}`;
      default:
        return null;
    }
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
      const version = this.isMissiveEnvironment ? 'vJS5.32' : 'vJS5.32 DEV';
      versionBadge.textContent = version;
      console.log(`Version updated to: ${version}`);
    }
  }

  // Legacy Missive event listeners removed - now handled by JS API integration

  // Legacy fallback auto-search methods removed - now handled by JS API integration

  // Legacy tryGetCurrentEmail method removed - now handled by JS API integration

  // Legacy Missive event handlers removed - now handled by JS API integration

  // -------- Email-extraction delegators --------
  // Thin wrappers that preserve the existing `this.foo(...)` call sites
  // throughout MissWooApp while routing all logic to the pure helpers in
  // `src/email-extract.js`. That module is loaded as a separate <script>
  // tag BEFORE app.js in every entry-point HTML file, and it's also
  // require()-able from jest in node — see `src/__tests__/email-extract.test.js`.
  //
  // Per the project rule "Fail loudly: throw errors when assumptions are
  // violated", these throw a clear error if EmailExtract didn't load
  // rather than silently no-oping. That makes a missing/404'd asset
  // immediately visible in production triage.

  _emailExtract() {
    if (typeof window === 'undefined' || !window.EmailExtract) {
      throw new Error(
        'EmailExtract helpers not loaded. ' +
        'Verify <script src="src/email-extract.js"> is loaded BEFORE src/app.js in the entry-point HTML.'
      );
    }
    return window.EmailExtract;
  }

  extractEmailFromData(data) {
    return this._emailExtract().extractEmailFromData(data);
  }

  extractEmailFromParticipants(participants) {
    return this._emailExtract().extractEmailFromParticipants(participants);
  }

  isValidEmailForSearch(email) {
    return this._emailExtract().isValidEmailForSearch(email);
  }

  searchForEmailsRecursively(obj, path, maxDepth, currentDepth) {
    return this._emailExtract().searchForEmailsRecursively(obj, path, maxDepth, currentDepth);
  }

  extractAllEmailsFromString(text) {
    return this._emailExtract().extractAllEmailsFromString(text);
  }

  extractEmailFromString(text) {
    return this._emailExtract().extractEmailFromString(text);
  }

  /**
   * Primary customer-email resolver - uses the documented Missive JS API.
   * See `src/email-extract.js` for the full contract; the host app
   * provides `window.Missive` to the pure helper.
   *
   * @see https://missiveapp.com/docs/developers/ui-iframe-integrations/javascript-api#method-getEmailAddresses
   */
  getCustomerEmailFromAPI(conversations) {
    var missive = (typeof window !== 'undefined') ? window.Missive : null;
    return this._emailExtract().getCustomerEmailFromAPI(conversations, missive);
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
        // CRITICAL: Clear old data before showing cached data
        // This prevents stale data from showing when clicking quickly
        this.allOrders = [];
        this.clearCurrentEmailData();
        this.activeDisplayEmail = null; // Clear active display email to prevent race conditions
        if (cached.email && this.isValidEmailForSearch(cached.email)) {
          this.performAutoSearch(cached.email, { clearSearchInput: true });
        }
        return;
      }

      try {
        // OPTIMIZATION: Mark as processing to prevent duplicate handling
        this.processingConversationId = conversationId;
        
        // CRITICAL: Clear old data immediately when starting new conversation
        // This prevents stale data from showing when clicking quickly
        this.allOrders = [];
        this.clearCurrentEmailData();
        this.activeDisplayEmail = null; // Clear active display email to prevent race conditions
      
      console.log(`📧 Processing clicked conversation: ${conversationId}`);
      
      // Fetch the single conversation
      const fetchedConversations = await Missive.fetchConversations([conversationId]);
      
      if (!Array.isArray(fetchedConversations) || fetchedConversations.length === 0) {
        console.log(`⚠️ No conversation data returned for ${conversationId}`);
        return;
      }

      const conversation = fetchedConversations[0];

      // Primary path: documented API. Returns the first non-internal address
      // across FROM/TO/CC/BCC/reply_to of the conversation in one call —
      // no shape-guessing required.
      let email = this.getCustomerEmailFromAPI(fetchedConversations);
      let emailSource = 'getEmailAddresses';

      // Fallback: parse the Conversation payload ourselves. Only hits when
      // the documented method is unavailable (older client) or returns no
      // valid match (e.g. all-internal thread).
      if (!email) {
        email = this.extractEmailFromData(conversation);
        emailSource = 'extractEmailFromData';
      }

      if (!email || !this.isValidEmailForSearch(email)) {
        console.log(`⚠️ No valid email found in conversation ${conversationId} (source: ${emailSource})`);
        // Still cache the conversation ID to avoid re-processing
        this.updateRecentlyOpenedCache(conversationId, null, false);
        return;
      }
      console.log(`✅ Resolved customer email via ${emailSource}: ${email}`);

      const normalizedEmail = this.normalizeEmail(email);
      console.log(`📧 Extracted email from conversation: ${email} (normalized: ${normalizedEmail})`);

      // Check if email data is already cached
      if (this.emailCache && this.emailCache.has(normalizedEmail) && this.isCacheValid(normalizedEmail, 'emailCache')) {
        console.log(`✅ Email ${normalizedEmail} already cached, using cached data`);
        this.updateRecentlyOpenedCache(conversationId, normalizedEmail, true);
        this.performAutoSearch(email, { clearSearchInput: true });
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
        // Set active display email before displaying
        this.activeDisplayEmail = normalizedEmail;
        // Display orders immediately with basic info (shows "Loading..." for serial/tracking)
        this.displayOrdersList();
        
        // Store the email this loadOrderDetails call is for (to prevent race conditions)
        const detailsForEmail = normalizedEmail;
        const detailsForOrders = [...this.allOrders]; // Clone orders array
        
        // Then load additional details in background (non-blocking)
        // This allows the UI to be responsive while data loads
        // OPTIMIZATION: Pass email to check if conversation is still active
        this.loadOrderDetails(detailsForOrders, detailsForEmail).then(() => {
          // CRITICAL: Only update UI if this email is still the current one
          // Prevents race condition where user clicks another email while details are loading
          const currentNormalizedEmail = this.normalizeEmail(this.lastSearchedEmail);
          if (currentNormalizedEmail !== detailsForEmail || this.activeDisplayEmail !== detailsForEmail) {
            console.log(`⚠️ Skipping UI update - email changed from ${detailsForEmail} to ${currentNormalizedEmail}`);
            return;
          }
          
          // Update allOrders with enhanced data
          this.allOrders = detailsForOrders;
          
          // Update cache with enhanced orders (includes notes, Katana data, serial numbers)
          if (this.emailCache) {
            this.emailCache.set(normalizedEmail, [...detailsForOrders]);
            this.setCacheExpiry(normalizedEmail, 'emailCache');
            this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
          }
          // Update UI with enhanced data (tracking numbers, serial numbers, etc.)
          // Instead of re-rendering entire list, just update the cells that changed
          this.updateOrderDetailsUI(detailsForOrders);
        }).catch(error => {
          // Don't log errors if conversation was closed (expected behavior)
          if (error.message === 'Conversation closed') {
            console.log(`⚠️ Background loading stopped - conversation closed for ${detailsForEmail}`);
            return;
          }
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
        // Set active display email before displaying
        this.activeDisplayEmail = normalizedEmail;
        // CRITICAL: Always call displayOrdersList() to update UI, even when no orders found
        // This ensures status changes from "Searching orders..." to "No orders found"
        this.displayOrdersList();
      }
      
      // Mark as processed
      this.updateRecentlyOpenedCache(conversationId, normalizedEmail, true);
      
      // Clear processing flag
      this.processingConversationId = null;
      
      console.log(`✅ Completed processing conversation ${conversationId} for email ${normalizedEmail}`);
    } catch (error) {
      if (error && error.name === 'AbortError') {
        console.log(`ℹ️ Auto-search cancelled for conversation ${conversationId}`);
      } else {
        console.error(`❌ Error processing conversation ${conversationId}:`, error);
      }
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
  // If expectedEmail is provided, will stop loading if conversation is closed
  async loadOrderDetails(orders, expectedEmail = null) {
    if (!orders || orders.length === 0) {
      return;
    }

    // Helper function to check if conversation is still active
    const isConversationActive = () => {
      if (!expectedEmail) return true; // No email check, continue loading
      // If lastSearchedEmail is null/empty, conversation was closed
      if (!this.lastSearchedEmail) {
        return false;
      }
      const currentEmail = this.normalizeEmail(this.lastSearchedEmail);
      return currentEmail === expectedEmail;
    };

    try {
      console.log(`📦 Loading details for ${orders.length} orders...`);
      
      // Step 1: Fetch order notes in parallel for all orders
      const notesPromises = orders.map(async (order) => {
        try {
          // Check if conversation is still active before each request
          if (!isConversationActive()) {
            throw new Error('Conversation closed');
          }
          
          // Only fetch if notes are not already present
          if (!order.notes || order.notes.length === 0) {
            const notesUrl = this.getAuthenticatedUrl(`/orders/${order.id}/notes`);
            order.notes = await this.makeRequest(notesUrl);
            console.log(`✅ Loaded ${order.notes?.length || 0} notes for order #${order.number}`);
          }
        } catch (error) {
          if (error.message === 'Conversation closed') {
            throw error; // Re-throw to stop processing
          }
          console.error(`❌ Failed to load notes for order ${order.id}:`, error);
          order.notes = [];
        }
      });
      
      await Promise.all(notesPromises);
      
      // Check if conversation is still active after notes
      if (!isConversationActive()) {
        throw new Error('Conversation closed');
      }
      
      // Step 2: Batch fetch Katana orders for all WooCommerce orders
      const wooOrderNumbers = orders.map(o => o.number);
      await this.batchGetKatanaOrders(wooOrderNumbers);
      
      // Check if conversation is still active after Katana
      if (!isConversationActive()) {
        throw new Error('Conversation closed');
      }
      
      console.log(`✅ Loaded Katana orders for ${orders.length} WooCommerce orders`);
      
      // Step 3: Batch fetch serial numbers for all orders
      await this.batchGetSerialNumbers(orders);
      
      // Check if conversation is still active after serial numbers
      if (!isConversationActive()) {
        throw new Error('Conversation closed');
      }
      
      console.log(`✅ Loaded serial numbers for ${orders.length} orders`);
      console.log(`✅ Completed loading all details for ${orders.length} orders`);
    } catch (error) {
      // Re-throw if conversation was closed (expected behavior)
      if (error.message === 'Conversation closed') {
        throw error;
      }
      console.error(`❌ Error loading order details:`, error);
      // Don't throw - allow partial loading to complete for other errors
    }
  }

  // Unified cache lookup - checks emailCache for cached orders
  // Returns cached orders array if found (including empty arrays), null if not cached
  getCachedOrdersData(normalizedEmail) {
    if (!normalizedEmail) return null;
    
    // Check emailCache (primary and only cache)
    if (this.emailCache?.has(normalizedEmail) && this.isCacheValid(normalizedEmail, 'emailCache')) {
      const cached = this.emailCache.get(normalizedEmail);
      if (Array.isArray(cached)) {
        // Return cached array even if empty (to avoid redundant API calls)
        return cached;
      }
    }
    
    return null;
  }

  // Auto-search triggered when user clicks on a conversation/email
  clearManualSearchInputs() {
    const candidates = [
      document.getElementById("orderSearch"),
      document.getElementById("searchInput")
    ].filter(Boolean);

    for (const input of candidates) {
      // Force-clear value and notify listeners so the visual value updates
      // immediately even when focus is inside the Missive iframe input.
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Prevent Enter from re-triggering stale manual search while
      // conversation-driven auto-search is already running.
      if (document.activeElement === input && typeof input.blur === 'function') {
        input.blur();
      }
    }

    console.log('🧹 Cleared manual search input for auto-search');
  }

  async performAutoSearch(email, options = {}) {
    const { clearSearchInput = false } = options;

    if (clearSearchInput) {
      this.clearManualSearchInputs();
    }

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

    // CRITICAL: Check if we're already displaying this email to prevent duplicate processing
    // This prevents race conditions when clicking through emails quickly
    if (this.activeDisplayEmail === normalizedEmail && this.allOrders.length > 0) {
      console.log(`⏳ Already displaying data for ${normalizedEmail}, skipping duplicate search`);
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
    // Clear active display email to prevent race conditions
    this.activeDisplayEmail = null;
    
    // CRITICAL: Set lastSearchedEmail early to ensure displayOrdersList() can verify the correct email
    this.lastSearchedEmail = email;

    // OPTIMIZATION: Unified cache lookup
    console.log(`🔍 Checking cache for email: ${normalizedEmail} (original: ${email})`);
    const cachedOrders = this.getCachedOrdersData(normalizedEmail);
    if (cachedOrders !== null) {
      // Cache hit (including empty arrays) - use cached data immediately
        console.log(`✅ Found cached data for ${normalizedEmail}: ${cachedOrders.length} orders`);
      this.allOrders = cachedOrders;
      // Set active display email before displaying
      this.activeDisplayEmail = normalizedEmail;
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
    
    // OPTIMIZATION: Start search immediately for click-triggered searches (no debounce delay)
    // Clear any pending debounce timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    // Set up timeout to prevent indefinite spinning. 12s was too aggressive
    // for slower WooCommerce responses and could abort valid auto-searches
    // mid-pagination (showing false "No orders found" states).
    const SEARCH_TIMEOUT_MS = 30000;
    const timeoutId = setTimeout(() => {
      if (this.activeSearchAbortController && !this.activeSearchAbortController.signal.aborted) {
        console.log(`⏱️ Search timeout reached (${SEARCH_TIMEOUT_MS / 1000}s), cancelling request`);
        this.activeSearchAbortController.abort();

        // Timeout is not equivalent to "no orders". Keep the current display
        // and surface an explicit timeout status so users can retry manually
        // without seeing a false empty-result state.
        this.setStatus("Search timed out. Please retry or search by order number or email.", 'error');
        this.hideLoading();

        this.searchInProgress = false;
        this.activeSearches.delete(normalizedEmail);
        // Clean up AbortController to prevent memory leaks
        this.activeSearchAbortController = null;
      }
    }, SEARCH_TIMEOUT_MS);

    // Execute search immediately (no setTimeout delay for click-triggered searches)
    (async () => {
      try {
        // Show searching status (only when actually searching API)
        this.setStatus("Searching orders...");
        
        // Use original email for API search (WooCommerce may need original format)
        // but use normalized email for cache storage
        console.log(`🔍 Starting API search for: ${email} (normalized: ${normalizedEmail})`);
        const orderResults = await this.searchWooCommerceOrders(email);
        
        // Clear timeout since search completed successfully
        clearTimeout(timeoutId);
        
        // OPTIMIZATION: Cache results in background even if search was cancelled
        // This allows faster loading if user returns to this email later
        if (Array.isArray(orderResults)) {
          // Cache the results even if cancelled (background caching)
          if (this.emailCache) {
            this.emailCache.set(normalizedEmail, orderResults);
            this.setCacheExpiry(normalizedEmail, 'emailCache');
            this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
            console.log(`💾 Background cached ${orderResults.length} orders for ${normalizedEmail} (search was cancelled)`);
          }
        }
        
        // OPTIMIZATION 4: Check if search was cancelled
        if (this.activeSearchAbortController?.signal.aborted) {
          console.log("Search was cancelled, ignoring results for UI (but cached in background)");
          // Don't update UI - search was cancelled (e.g., user clicked another email)
          // The new search will handle the UI update
          // Results are already cached above for future use
          return;
        }
        
        if (Array.isArray(orderResults)) {
          this.allOrders = orderResults;
          console.log(`📊 API search completed: ${orderResults.length} orders found`);
          // Set active display email before displaying
          this.activeDisplayEmail = normalizedEmail;
          this.displayOrdersList();
          // Status is already set by displayOrdersList (handles both found and not found cases), no need to set again
          
          // CRITICAL: Load additional details (notes, Katana orders, serial numbers) in background
          // This matches the behavior in processClickedConversation() to ensure serial numbers and tracking load
          if (this.allOrders.length > 0) {
            const detailsForEmail = normalizedEmail;
            const detailsForOrders = [...this.allOrders]; // Clone orders array
            
            // Load additional details in background (non-blocking)
            this.loadOrderDetails(detailsForOrders, detailsForEmail).then(() => {
              // CRITICAL: Only update UI if this email is still the current one
              // Prevents race condition where user clicks another email while details are loading
              const currentNormalizedEmail = this.normalizeEmail(this.lastSearchedEmail);
              if (currentNormalizedEmail !== detailsForEmail || this.activeDisplayEmail !== detailsForEmail) {
                console.log(`⚠️ Skipping UI update - email changed from ${detailsForEmail} to ${currentNormalizedEmail}`);
                return;
              }
              
              // Update allOrders with enhanced data
              this.allOrders = detailsForOrders;
              
              // Update cache with enhanced orders (includes notes, Katana data, serial numbers)
              if (this.emailCache) {
                this.emailCache.set(normalizedEmail, [...detailsForOrders]);
                this.setCacheExpiry(normalizedEmail, 'emailCache');
                this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
              }
              // Update UI with enhanced data (tracking numbers, serial numbers, etc.)
              // Instead of re-rendering entire list, just update the cells that changed
              this.updateOrderDetailsUI(detailsForOrders);
            }).catch(error => {
              // Don't log errors if conversation was closed (expected behavior)
              if (error.message === 'Conversation closed') {
                console.log(`⚠️ Background loading stopped - conversation closed for ${detailsForEmail}`);
                return;
              }
              console.error(`❌ Error loading additional details:`, error);
              // Still cache basic orders even if details fail
              if (this.emailCache) {
                this.emailCache.set(normalizedEmail, [...this.allOrders]);
                this.setCacheExpiry(normalizedEmail, 'emailCache');
                this.enforceCacheSizeLimit(this.emailCache, 'emailCache', this.cacheConfig.maxCacheSize);
              }
            });
          }
        } else {
          console.log(`⚠️ API search returned non-array result:`, orderResults);
          this.allOrders = [];
          // Set active display email before displaying
          this.activeDisplayEmail = normalizedEmail;
          this.displayOrdersList(); // This will set status to "No orders found" and hide loading
        }
        
      } catch (error) {
        // Clear timeout on error
        clearTimeout(timeoutId);
        
        // Don't log abort errors as errors
        if (error.name === 'AbortError' || error.message === 'Search cancelled') {
          console.log("Search cancelled");
          // Don't update UI - search was cancelled (e.g., user clicked another email)
          // The new search will handle the UI update
          return;
        }
        console.error("❌ Search failed:", error);
        this.setStatus("Search failed");
        this.hideLoading();
      } finally {
        this.searchInProgress = false;
        this.activeSearches.delete(normalizedEmail);
        this.lastSearchedEmail = email;
      }
    })();
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