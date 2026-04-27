// Missive JS API bridge (vJS5.23)
//
// Thin adapter that:
//   1. Boots the MissWooApp once `window.config` and `window.MissWooApp` exist.
//   2. Wires manual search controls (button click, Enter key) to the app.
//   3. Forwards the documented `change:conversations` event into the app.
//
// Reference: https://missiveapp.com/docs/developers/ui-iframe-integrations/javascript-api
//
// Per the official API doc, the only events that exist on `Missive.on(...)`
// are `main_action`, `message_sent`, `change:conversations`, and
// `change:users`. Earlier revisions of this bridge listened to `ready`,
// `error`, `email:open`, `thread:focus`, `conversation:focus`, and
// `conversation:open` — none of which fire — and called undocumented
// methods like `getCurrentConversation`, `getCurrentUser`, `getUsers`,
// `getTeams`, and `getChannels`. Those have been removed.

const VERSION_BADGE_TEXT = 'vJS5.23';
const MISSIVE_SCRIPT_SELECTOR = 'script[src*="integrations.missiveapp.com/missive.js"]';
const APP_BOOT_RETRY_MS = 500;
const MISSIVE_POLL_INTERVAL_MS = 100;
const MISSIVE_LOAD_TIMEOUT_MS = 2000;

class MissiveJSBridge {
  constructor() {
    this.app = null;
    this.eventsBound = false;
    this.init();
  }

  init() {
    this.setBadge(VERSION_BADGE_TEXT);
    this.bootApp();
    this.bindManualSearchEvents();
    this.waitForMissive()
      .then(() => this.bindMissiveEvents())
      .catch((err) => {
        // Fail loudly per repo conventions — Missive script unavailable in
        // this environment is a real configuration problem, not a no-op.
        console.error('Missive SDK not available, skipping event binding:', err);
      });
  }

  /** Pin the visible version badge in the iframe header. */
  setBadge(text) {
    const el = document.querySelector('.version-badge');
    if (el) el.textContent = text;
  }

  /**
   * Construct the MissWooApp once its dependencies are present. config.js
   * and src/app.js are loaded synchronously before this script in the
   * three index*.html entry points, so the retry only protects against
   * unusual load orders (e.g. dynamic injection).
   */
  bootApp() {
    if (this.app) return;
    if (!window.config || !window.MissWooApp) {
      setTimeout(() => this.bootApp(), APP_BOOT_RETRY_MS);
      return;
    }

    try {
      this.app = new MissWooApp(window.config);
    } catch (err) {
      console.error('Failed to initialize MissWooApp:', err);
      return;
    }

    // Re-pin our badge after the app's own header writer runs, so the app's
    // internal version string doesn't overwrite the bridge build version.
    if (typeof this.app.updateHeaderWithVersion === 'function') {
      const originalUpdateHeader = this.app.updateHeaderWithVersion.bind(this.app);
      this.app.updateHeaderWithVersion = () => {
        originalUpdateHeader();
        this.setBadge(VERSION_BADGE_TEXT);
      };
    }
  }

  /** Wire the in-iframe search input + button to the app's search handler. */
  bindManualSearchEvents() {
    const searchButton = document.getElementById('searchBtn');
    if (searchButton) {
      searchButton.addEventListener('click', () => this.app?.handleSearch?.());
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.app?.handleSearch?.();
      });
    }
  }

  /**
   * Resolve once `window.Missive` is defined. The SDK script is loaded
   * synchronously in <head>, so this normally resolves on the first tick.
   * Falls back to a script `load` event then a short poll capped by a 2s
   * timeout.
   */
  waitForMissive() {
    return new Promise((resolve, reject) => {
      if (window.Missive) {
        resolve();
        return;
      }

      const script = document.querySelector(MISSIVE_SCRIPT_SELECTOR);
      let resolved = false;
      let poller;
      let timeout;

      const cleanup = () => {
        if (script) {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        }
        if (poller) clearInterval(poller);
        if (timeout) clearTimeout(timeout);
      };

      const finish = (ok, err) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (ok) {
          resolve();
        } else {
          reject(err);
        }
      };

      const onLoad = () => {
        if (window.Missive) {
          finish(true);
        } else {
          finish(false, new Error('Missive script loaded but window.Missive is undefined'));
        }
      };

      const onError = () => finish(false, new Error('Missive script failed to load'));

      if (script) {
        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);
      }

      poller = setInterval(() => {
        if (window.Missive) finish(true);
      }, MISSIVE_POLL_INTERVAL_MS);

      timeout = setTimeout(
        () => finish(false, new Error(`Missive API not available after ${MISSIVE_LOAD_TIMEOUT_MS}ms`)),
        MISSIVE_LOAD_TIMEOUT_MS
      );
    });
  }

  /**
   * Subscribe to the documented `change:conversations` event and forward
   * the conversation IDs into the app. The app already handles the array
   * shape (see `MissWooApp.handleConversationChange`).
   */
  bindMissiveEvents() {
    if (this.eventsBound) return;
    if (!window.Missive || typeof Missive.on !== 'function') {
      console.error('Missive.on is not a function; cannot bind change:conversations');
      return;
    }
    this.eventsBound = true;

    Missive.on('change:conversations', (ids) => {
      if (!this.app || typeof this.app.handleConversationChange !== 'function') {
        // App still booting — drop this event; the next selection change
        // will retrigger once the app is ready.
        return;
      }
      this.app.handleConversationChange(ids);
    });
  }
}

try {
  new MissiveJSBridge();
} catch (err) {
  console.error('Failed to init MissiveJSBridge', err);
}
