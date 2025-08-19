// Suggest optimized version for performance

// Missive JS API variant (vJS3.32)
// Minimal wrapper that relies on Missive JavaScript API events and forwards
// context to the existing MissWooApp via window.app when possible.

// This file assumes index-missive-js.html loads missive.js and src/config.js first.

class MissiveJSBridge {
  constructor() {
    this.isReady = false;
    this.init();
  }

  init() {
    // Force version badge to vJS3.32
    this.setBadge('vJS3.32');

    if (!window.Missive) {
      // Wait for Missive script to be present
      const check = setInterval(() => {
        if (window.Missive) {
          clearInterval(check);
          this.bind();
        }
      }, 200);
      // Also bootstrap app so the page works in web mode
      this.bootstrapApp();
      return;
    }

    this.bind();
    this.bootstrapApp();
  }

  setBadge(text) {
    const el = document.querySelector('.version-badge');
    if (el) el.textContent = text;
  }

  bootstrapApp() {
    try {
      if (!window.app && window.config) {
        window.app = new MissWooApp(window.config);
      }
      // Override version badge to vJS3.32 once app updates header
      setTimeout(() => this.setBadge('vJS3.32'), 300);
    } catch (e) {
      // no-op
    }
  }

  bind() {
    if (this.isReady) return;
    this.isReady = true;

    // Core lifecycle
    Missive.on('ready', async () => {
      this.setBadge('vJS3.32');
      if (window.app?.setStatus) window.app.setStatus('Ready');
      // On ready, try to fetch current conversation/email once
      await this.tryPrimeEmail();
    });

    Missive.on('error', (err) => {
      if (window.app?.setStatus) window.app.setStatus('Missive error', 'error');
      console.error('Missive error:', err);
    });

    // High-signal events
    const forward = async (data) => {
      if (!window.app) return;
      const email = window.app.extractEmailFromData?.(data);
      if (email && window.app.isValidEmailForSearch?.(email)) {
        await window.app.performAutoSearch(email);
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
      if (!window.app) return;

      // Prefer current conversation → participants → external email
      if (Missive.getCurrentConversation) {
        const conv = await Missive.getCurrentConversation();
        const email = window.app.extractEmailFromData(conv);
        if (email && window.app.isValidEmailForSearch(email)) {
          await window.app.performAutoSearch(email);
          return;
        }
      }

      // Fallback: recent messages from focused conversation if available
      if (Missive.fetchMessages && Missive.getCurrentConversation) {
        const conv = await Missive.getCurrentConversation();
        if (conv?.id) {
          const messages = await Missive.fetchMessages(conv.id, { limit: 10 });
          const email = window.app.extractEmailFromData({ messages });
          if (email && window.app.isValidEmailForSearch(email)) {
            await window.app.performAutoSearch(email);
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


