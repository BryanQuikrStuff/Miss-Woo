// Missive JS API bridge (vJS5.30)
//
// Thin adapter that:
//   1. Boots the MissWooApp once `window.config` and `window.MissWooApp` exist.
//   2. Wires manual search controls (button click, Enter key) to the app.
//   3. Pins the version badge in the iframe header.
//
// Reference: https://missiveapp.com/docs/developers/ui-iframe-integrations/javascript-api
//
// As of vJS5.30 this bridge no longer subscribes to Missive events. The
// `change:conversations` listener was moved into
// `MissWooApp.setupMissiveEventListeners()` so the app owns its own
// integration end-to-end. Earlier revisions of this file listened to
// `ready`, `error`, `email:open`, `thread:focus`, `conversation:focus`,
// `conversation:open` (none of which fire in Missive's documented API)
// and called undocumented methods like `getCurrentConversation`,
// `getCurrentUser`, `getUsers`, `getTeams`, `getChannels`. Those were
// removed in vJS5.19; the remaining wait-for-Missive promise + bridge
// `Missive.on` wrapper were removed in vJS5.30 since `src/app.js` has
// always had its own equivalent wait machinery.

const VERSION_BADGE_TEXT = 'vJS5.30';
const APP_BOOT_RETRY_MS = 500;

class MissiveJSBridge {
  constructor() {
    this.app = null;
    this.init();
  }

  init() {
    this.setBadge(VERSION_BADGE_TEXT);
    this.bootApp();
    this.bindManualSearchEvents();
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
}

try {
  new MissiveJSBridge();
} catch (err) {
  console.error('Failed to init MissiveJSBridge', err);
}
