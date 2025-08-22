// Missive JS API variant (vJS3.40)
// Complete implementation with full MissWooApp functionality

// This file assumes index-missive-js.html loads missive.js and src/config.js first.

class MissiveJSBridge {
  constructor() {
    this.isReady = false;
    this.app = null;
    this.init();
  }

  init() {
    // Force version badge to vJS3.40
    this.setBadge('vJS3.40');

    // Initialize the full MissWooApp first
    this.initializeApp();

    // Wait a bit for the app to be fully initialized before binding events
    setTimeout(() => {
      if (!window.Missive) {
        // Wait for Missive script to be present
        const check = setInterval(() => {
          if (window.Missive) {
            clearInterval(check);
            this.bindMissiveEvents();
          }
        }, 200);
        return;
      }

      this.bindMissiveEvents();
    }, 500); // Wait 500ms for app initialization
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
        
        // Override version badge to vJS3.40 once app updates header
        setTimeout(() => this.setBadge('vJS3.40'), 300);
        
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
  }

  bindMissiveEvents() {
    if (this.isReady) return;
    this.isReady = true;

    // Core lifecycle
    Missive.on('ready', async () => {
      this.setBadge('vJS3.38');
      if (this.app?.setStatus) this.app.setStatus('Ready');
      // On ready, try to fetch current conversation/email once
      await this.tryPrimeEmail();
    });

    Missive.on('error', (err) => {
      if (this.app?.setStatus) this.app.setStatus('Missive error', 'error');
      console.error('Missive error:', err);
    });

    // High-signal events - forward to app
    const forward = async (data) => {
      console.log('📧 Missive event received:', data);
      console.log('📧 Current app state:', !!this.app);
      
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
        await this.app.performAutoSearch(email);
      } else {
        console.log('❌ Invalid email or not valid for search:', email);
      }
    };

    Missive.on('email:focus', forward);
    Missive.on('email:open', forward);
    Missive.on('thread:focus', forward);
    Missive.on('conversation:focus', forward);
    Missive.on('conversation:open', forward);
    Missive.on('change:conversations', forward);
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


