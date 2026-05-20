// Missive JS API bridge (vJS5.34)
//
// Thin adapter that:
//   1. Boots the MissWooApp once `window.config` and `window.MissWooApp` exist.
//   2. Pins the version badge in the iframe header.
//
// Reference: https://missiveapp.com/docs/developers/ui-iframe-integrations/javascript-api
//
// As of vJS5.32 this bridge no longer subscribes to Missive events. The
// `change:conversations` listener was moved into
// `MissWooApp.setupMissiveEventListeners()` so the app owns its own
// integration end-to-end. Earlier revisions of this file listened to
// `ready`, `error`, `email:open`, `thread:focus`, `conversation:focus`,
// `conversation:open` (none of which fire in Missive's documented API)
// and called undocumented methods like `getCurrentConversation`,
// `getCurrentUser`, `getUsers`, `getTeams`, `getChannels`. Those were
// removed in vJS5.19; the remaining wait-for-Missive promise + bridge
// `Missive.on` wrapper were removed in vJS5.32 since `src/app.js` has
// always had its own equivalent wait machinery.
//
// As of vJS5.34 this bridge also no longer binds the manual search
// button + Enter key. `MissWooApp.setupMissiveEventListeners()` already
// binds those via `boundHandleSearch`, so the bridge's identical bindings
// caused every click / Enter to fire `handleSearch` twice. The second
// invocation aborted the first's request, and `makeRequest`'s URL-based
// deduplication then made both invocations await the same already-aborted
// promise - the race manifested as searches that perpetually cancelled
// themselves before any HTTP call could complete (most visible on the
// vJS5.33 name-search path because of its richer logging). The app's
// search bindings are the single source of truth now.

const VERSION_BADGE_TEXT = 'vJS5.34';
const APP_BOOT_RETRY_MS = 500;

class MissiveJSBridge {
  constructor() {
    this.app = null;
    this.init();
  }

  init() {
    this.setBadge(VERSION_BADGE_TEXT);
    this.bootApp();
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
}

try {
  new MissiveJSBridge();
} catch (err) {
  console.error('Failed to init MissiveJSBridge', err);
}
