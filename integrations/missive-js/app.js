// Missive JS API variant (vJS3.43)
// Complete implementation with full MissWooApp functionality

// This file assumes index-missive-js.html loads missive.js and src/config.js first.

class MissiveJSBridge {
  constructor() {
    this.isReady = false;
    this.app = null;
    this.init();
  }

  init() {
    console.log('🚀 Initializing MissiveJSBridge...');
    
    // Force version badge to vJS3.43
    this.setBadge('vJS3.43');

    // Initialize the full MissWooApp first
    this.initializeApp();

    // Enhanced initialization with better error handling
    const initializeMissive = () => {
      console.log('🔧 Checking for Missive API...');
      console.log('🔧 window.Missive available:', !!window.Missive);
      
      if (!window.Missive) {
        console.log('⏳ Missive API not available yet, waiting...');
        return false;
      }

      console.log('✅ Missive API detected, binding events...');
      this.bindMissiveEvents();
      return true;
    };

    // Try immediate initialization
    if (!initializeMissive()) {
      // Wait for Missive script to be present with timeout
      let attempts = 0;
      const maxAttempts = 25; // 5 seconds total
      
      const checkInterval = setInterval(() => {
        attempts++;
        console.log(`🔧 Attempt ${attempts}/${maxAttempts} to find Missive API...`);
        
        if (initializeMissive()) {
          clearInterval(checkInterval);
        } else if (attempts >= maxAttempts) {
          console.error('❌ Missive API not found after 5 seconds');
          clearInterval(checkInterval);
          
          // Fallback: try to bind events anyway in case Missive loads later
          setTimeout(() => {
            console.log('🔄 Fallback: Attempting to bind events...');
            this.bindMissiveEvents();
          }, 2000);
        }
      }, 200);
    }
  }

  setBadge(text) {
    const el = document.querySelector('.version-badge');
    if (el) el.textContent = text;
  }

  initializeApp() {
    try {
      console.log('🔧 Initializing MissWooApp...');
      console.log('🔧 window.config available:', !!window.config);
      console.log('🔧 window.MissWooApp available:', !!window.MissWooApp);
      
      if (window.config && window.MissWooApp) {
        console.log('🔧 Creating MissWooApp instance...');
        this.app = new MissWooApp(window.config);
        console.log('🔧 MissWooApp instance created:', !!this.app);
        
        // Override version badge to vJS3.43 once app updates header
        setTimeout(() => this.setBadge('vJS3.43'), 300);
        
        // Bind manual search events
        this.bindManualSearchEvents();
        
        console.log('✅ MissWooApp initialization complete');
      } else {
        console.log('❌ Missing dependencies for MissWooApp initialization');
        console.log('❌ window.config:', !!window.config);
        console.log('❌ window.MissWooApp:', !!window.MissWooApp);
        
        // Retry initialization after a delay
        setTimeout(() => {
          console.log('🔄 Retrying MissWooApp initialization...');
          this.initializeApp();
        }, 1000);
      }
    } catch (e) {
      console.error('❌ Failed to initialize MissWooApp:', e);
      
      // Retry initialization after a delay
      setTimeout(() => {
        console.log('🔄 Retrying MissWooApp initialization after error...');
        this.initializeApp();
      }, 1000);
    }
  }

  bindManualSearchEvents() {
    // Bind search button click
    const searchButton = document.getElementById('searchBtn');
    if (searchButton) {
      searchButton.onclick = () => {
        console.log('🔍 Manual search button clicked');
        if (this.app?.handleSearch) {
          this.app.handleSearch();
        }
      };
    }

    // Bind search input enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          console.log('🔍 Manual search enter key pressed');
          if (this.app?.handleSearch) {
            this.app.handleSearch();
          }
        }
      };
    }

    // Add debug methods to window for testing
    window.MissWooDebug = {
      triggerTestSearch: (email) => {
        console.log('🧪 Debug: Triggering test search for:', email);
        if (this.app && this.app.performAutoSearch) {
          this.app.performAutoSearch(email);
        } else {
          console.error('❌ App not available for test search');
        }
      },
      checkMissiveAPI: () => {
        console.log('🧪 Debug: Missive API status:', {
          available: !!window.Missive,
          ready: this.isReady,
          app: !!this.app
        });
        return {
          missiveAvailable: !!window.Missive,
          bridgeReady: this.isReady,
          appAvailable: !!this.app
        };
      },
      forceEventTest: () => {
        console.log('🧪 Debug: Testing event handling...');
        if (this.app && this.app.performAutoSearch) {
          // Simulate an email event
          const testData = {
            email: 'test@example.com',
            from: { email: 'test@example.com', name: 'Test User' }
          };
          console.log('🧪 Simulating email event with:', testData);
          this.app.performAutoSearch('test@example.com');
        }
      }
    };

    console.log('🧪 Debug methods available: window.MissWooDebug');
  }

  bindMissiveEvents() {
    if (this.isReady) return;
    this.isReady = true;

    console.log('🔧 Setting up Missive event listeners...');

    // Core lifecycle
    Missive.on('ready', async () => {
      console.log('✅ Missive ready event received');
      this.setBadge('vJS3.43');
      if (this.app?.setStatus) this.app.setStatus('Ready');
      // On ready, try to fetch current conversation/email once
      await this.tryPrimeEmail();
    });

    Missive.on('error', (err) => {
      console.error('❌ Missive error event:', err);
      if (this.app?.setStatus) this.app.setStatus('Missive error', 'error');
    });

    // Enhanced event forwarding with better debugging
    const forward = async (eventType, data) => {
      console.log(`📧 Missive ${eventType} event received:`, data);
      console.log('📧 Current app state:', !!this.app);
      console.log('📧 Window.Missive available:', !!window.Missive);
      
      // Wait for app to be available if it's not ready yet
      if (!this.app) {
        console.log('⏳ App not available yet, waiting...');
        // Wait up to 5 seconds for app to be ready
        for (let i = 0; i < 50; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (this.app) {
            console.log('✅ App is now available');
            break;
          }
          if (i % 10 === 0) { // Log every second
            console.log(`⏳ Still waiting for app... (${i/10}s)`);
          }
        }
        if (!this.app) {
          console.log('❌ App still not available after waiting');
          console.log('❌ Trying to reinitialize app...');
          this.initializeApp();
          return;
        }
      }
      
      // Double-check that app methods are available
      if (!this.app.extractEmailFromData || !this.app.isValidEmailForSearch || !this.app.performAutoSearch) {
        console.log('❌ App methods not available:', {
          extractEmailFromData: !!this.app.extractEmailFromData,
          isValidEmailForSearch: !!this.app.isValidEmailForSearch,
          performAutoSearch: !!this.app.performAutoSearch
        });
        return;
      }
      
      const email = this.app.extractEmailFromData(data);
      console.log('📧 Extracted email:', email);
      if (email && this.app.isValidEmailForSearch(email)) {
        console.log('🔍 Triggering auto-search for:', email);
        try {
          await this.app.performAutoSearch(email);
          console.log('✅ Auto-search completed for:', email);
        } catch (error) {
          console.error('❌ Auto-search failed:', error);
          if (this.app?.setStatus) this.app.setStatus('Auto-search failed', 'error');
        }
      } else {
        console.log('❌ Invalid email or not valid for search:', email);
        if (this.app?.setStatus) this.app.setStatus('No valid email found', 'error');
      }
    };

    // Bind events with enhanced debugging
    const events = [
      'email:focus',
      'email:open', 
      'thread:focus',
      'conversation:focus',
      'conversation:open',
      'change:conversations'
    ];

    events.forEach(eventType => {
      console.log(`🔧 Binding ${eventType} event listener`);
      Missive.on(eventType, (data) => forward(eventType, data));
    });

    console.log('✅ All Missive event listeners bound');
  }

  async tryPrimeEmail() {
    try {
      console.log('🔍 Trying to prime email on Missive ready...');
      if (!this.app) {
        console.log('❌ App not available for priming');
        return;
      }

      // Prefer current conversation → participants → external email
      if (Missive.getCurrentConversation) {
        console.log('📧 Trying getCurrentConversation...');
        const conv = await Missive.getCurrentConversation();
        console.log('📧 Current conversation:', conv);
        const email = this.app.extractEmailFromData(conv);
        console.log('📧 Extracted email from conversation:', email);
        if (email && this.app.isValidEmailForSearch(email)) {
          console.log('🔍 Priming auto-search for:', email);
          await this.app.performAutoSearch(email);
          return;
        }
      }

      // Fallback: recent messages from focused conversation if available
      if (Missive.fetchMessages && Missive.getCurrentConversation) {
        console.log('📧 Trying fetchMessages fallback...');
        const conv = await Missive.getCurrentConversation();
        if (conv?.id) {
          const messages = await Missive.fetchMessages(conv.id, { limit: 10 });
          console.log('📧 Fetched messages:', messages);
          const email = this.app.extractEmailFromData({ messages });
          console.log('📧 Extracted email from messages:', email);
          if (email && this.app.isValidEmailForSearch(email)) {
            console.log('🔍 Priming auto-search for:', email);
            await this.app.performAutoSearch(email);
          }
        }
      }
      
      console.log('📧 No email found for priming');
    } catch (e) {
      console.error('❌ Error priming email:', e);
    }
  }
}

// Initialize bridge as soon as possible
try {
  new MissiveJSBridge();
} catch (e) {
  console.error('Failed to init MissiveJSBridge', e);
}


