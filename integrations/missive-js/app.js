// Missive JS API variant (vJS3.36)
// Complete implementation with full MissWooApp functionality

// This file assumes index-missive-js.html loads missive.js and src/config.js first.

class MissiveJSBridge {
  constructor() {
    this.isReady = false;
    this.app = null;
    this.init();
  }

  init() {
    // Force version badge to vJS3.36
    this.setBadge('vJS3.36');

    // Initialize the full MissWooApp
    this.initializeApp();

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
  }

  setBadge(text) {
    const el = document.querySelector('.version-badge');
    if (el) el.textContent = text;
  }

  initializeApp() {
    try {
      if (window.config) {
        this.app = new MissWooApp(window.config);
        // Override version badge to vJS3.36 once app updates header
        setTimeout(() => this.setBadge('vJS3.36'), 300);
        
        // Bind manual search events
        this.bindManualSearchEvents();
      }
    } catch (e) {
      console.error('Failed to initialize MissWooApp:', e);
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
      this.setBadge('vJS3.36');
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
      if (!this.app) {
        console.log('❌ App not available for event');
        return;
      }
      const email = this.app.extractEmailFromData?.(data);
      console.log('📧 Extracted email:', email);
      if (email && this.app.isValidEmailForSearch?.(email)) {
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


