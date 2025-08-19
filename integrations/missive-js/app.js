// Missive JS API variant (vJS3.34)
// Complete implementation with full MissWooApp functionality

// This file assumes index-missive-js.html loads missive.js and src/config.js first.

class MissiveJSBridge {
  constructor() {
    this.isReady = false;
    this.app = null;
    this.init();
  }

  init() {
    // Force version badge to vJS3.34
    this.setBadge('vJS3.34');

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
        // Override version badge to vJS3.32 once app updates header
        setTimeout(() => this.setBadge('vJS3.32'), 300);
      }
    } catch (e) {
      console.error('Failed to initialize MissWooApp:', e);
    }
  }

  bindMissiveEvents() {
    if (this.isReady) return;
    this.isReady = true;

    // Core lifecycle
    Missive.on('ready', async () => {
      this.setBadge('vJS3.32');
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
      if (!this.app) return;
      const email = this.app.extractEmailFromData?.(data);
      if (email && this.app.isValidEmailForSearch?.(email)) {
        await this.app.performAutoSearch(email);
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
      if (!this.app) return;

      // Prefer current conversation → participants → external email
      if (Missive.getCurrentConversation) {
        const conv = await Missive.getCurrentConversation();
        const email = this.app.extractEmailFromData(conv);
        if (email && this.app.isValidEmailForSearch(email)) {
          await this.app.performAutoSearch(email);
          return;
        }
      }

      // Fallback: recent messages from focused conversation if available
      if (Missive.fetchMessages && Missive.getCurrentConversation) {
        const conv = await Missive.getCurrentConversation();
        if (conv?.id) {
          const messages = await Missive.fetchMessages(conv.id, { limit: 10 });
          const email = this.app.extractEmailFromData({ messages });
          if (email && this.app.isValidEmailForSearch(email)) {
            await this.app.performAutoSearch(email);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

// Initialize bridge as soon as possible
try {
  new MissiveJSBridge();
} catch (e) {
  console.error('Failed to init MissiveJSBridge', e);
}


