
# Miss-Woo Integration

**Version**: vJS5.25  
**Status**: Active Development  
**Last Updated**: January 2025

Use this as the Integration URL in Missive to validate dynamic email access before wiring into the main app.

### Production Deployment
- **GitHub Pages**: Automatically deployed from `main` branch
- **URL**: https://bryanquikrstuff.github.io/Miss-Woo/
- **Files**: Uses `index.html` (production paths)

## 📁 File Structure

```
Miss-Woo/
├── index.html          # Production HTML (no src/ paths)
├── index-dev.html      # Development HTML (uses src/ paths)
├── src/
│   ├── app.js         # Main application logic
│   ├── config.js      # API configuration
│   └── styles.css     # Application styles
└── .github/workflows/
    └── main.yml       # CI/CD pipeline
```

## 🔧 Development Workflow

### Local Development
1. Use `index-dev.html` for local development
2. Files reference `src/` directory
3. Run `npx http-server -p 3000 --cors`
4. Open `http://localhost:3000/index-dev.html`

### Production Deployment
1. `index.html` uses root-level paths (no `src/`)
2. GitHub Actions copies files from `src/` to `dist/`
3. Deployed to GitHub Pages automatically
4. Available at: https://bryanquikrstuff.github.io/Miss-Woo/

## ⚙️ Configuration

### Environment Variables (GitHub Secrets)
- `WOOCOMMERCE_CONSUMER_KEY`: WooCommerce API consumer key
- `WOOCOMMERCE_CONSUMER_SECRET`: WooCommerce API consumer secret  
- `WOOCOMMERCE_SITE_URL`: WooCommerce site URL
- `KATANA_API_KEY`: Katana MRP API key

### Local Development
Create a `.env` file in the root directory:
```env
WOOCOMMERCE_CONSUMER_KEY=your_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_secret_here
WOOCOMMERCE_SITE_URL=https://your-site.com
KATANA_API_KEY=your_katana_key_here
```

## 🎯 Features

### Missive Integration
- **Auto-search**: Automatically searches for orders when email is focused
- **Environment Detection**: Detects Missive vs. web environment
- **Event Listeners**: Responds to email focus, thread changes, and conversation changes

### WooCommerce Integration
- **Order Search**: Search by customer email or order ID
- **Order Details**: Display order information, tracking, and serial numbers
- **Katana MRP**: Fetch serial numbers from Katana MRP system

### User Interface
- **Environment-aware**: Different UI for Missive vs. web
- **Responsive Design**: Works on desktop and mobile
- **Error Handling**: Graceful error display and recovery

## 🧪 Testing

```bash
npm test
```

Runs Jest tests for:
- WooCommerce API integration
- Application setup and initialization

## 📦 Deployment

### Automatic Deployment
- **Trigger**: Push to `main` branch
- **Process**: 
  1. Run tests
  2. Build production files
  3. Deploy to GitHub Pages
- **URL**: https://bryanquikrstuff.github.io/Miss-Woo/

### Manual Deployment
```bash
# Build production files
mkdir -p dist
cp index.html dist/
cp src/app.js dist/
cp src/styles.css dist/
cp src/config.js dist/

# Deploy to any static hosting service
```

## 🔍 Troubleshooting

### Common Issues

1. **404 Errors in Missive**: 
   - Check that GitHub Actions deployment completed
   - Verify files are in the correct paths (no `src/` in production)

2. **Loading State Stuck**:
   - Check browser console for errors
   - Verify API keys are configured correctly

3. **Auto-search Not Working**:
   - Ensure Missive environment is detected
   - Check that email events are being received

### Debug Mode
Open browser console to see detailed logs:
- Environment detection
- API calls and responses
- Error messages and stack traces

## 📝 Changelog

### vJS5.25 (Current)
- Behavior: `handleConversationChange()` now bails out unless the inbound `change:conversations` event carries exactly one conversation ID. The Missive doc treats this event as a *selection-changed* signal, not a click event — the array reflects the current inbox selection (0 on deselect, 1 on focus, N on shift/cmd-click batch ops). Previously the handler gated only on `data.length > 0` and unconditionally took `data[0]`, which meant bulk-labeling 20 conversations triggered a full WooCommerce + Katana + serial-number pipeline against an arbitrary one of those 20 — wasted API quota and the occasional confusing "I selected a label group, why is the sidebar showing customer X?" outcome. Now: zero or multi-element arrays leave the previously-displayed lookup on screen (the right UX) and only single-focus events run the pipeline. Downstream debounce, dedup, and processing logic unchanged.

### vJS5.24
- Bug fix: Cache poisoning in `getTrackingInfo()` was the actual reason every order kept rendering "Not Shipped Yet" through vJS5.21–vJS5.23. The order render flow makes two passes: (1) `displayOrdersList()` runs immediately after search returns, when `order.notes = []` (notes are fetched lazily); the empty-notes pass found no tracking and wrote `order._cachedTrackingInfo = null`. (2) `loadOrderDetails()` then async-fetched notes and triggered `updateOrderDetailsUI()` → `getTrackingInfo()` again — but the function's first action was `if (order._cachedTrackingInfo !== undefined) return order._cachedTrackingInfo`, which short-circuited on the stale null cached during the pre-fetch pass. The freshly-loaded notes were never scanned. This also explains why the diagnostic logging added in vJS5.23 produced zero output: the function body was bypassed on the only call that had data to work with.
- Behavior: cache check changed from "any non-undefined value" to "any truthy value". The field is only written when a real tracking match is found; null results are returned but not memoized, so the post-fetch render gets a fresh scan against the now-loaded notes. Performance impact is negligible (~500 regex evaluations per search, well under 1ms).
- Diagnostic logging from vJS5.23 will now actually fire. If a shipped order still doesn't surface a tracking link, expect a single console line per order showing the first 200 chars of `note[0]`, telling us precisely what format the matcher is missing.

### vJS5.23
- Bug fix: Restores the loose digit-run fallbacks in `extractTrackingFromText()` that vJS5.21 had dropped — `\b\d{10}\b -> DHL`, `\b\d{12}\b -> FedEx`, `\b\d{15}\b -> FedEx`. Production logs from vJS5.22 (multiple test customers, multiple completed orders, 5–6 notes each) showed zero successful tracking matches, indicating that QuikrStuff fulfillment notes commonly contain bare 10-digit DHL Express AWBs without the literal "DHL" prefix. Stage 1 (carrier-named) and stage 2 (shape-unique: USPS 9[234]…, UPS 1Z…, UPS T+10) couldn't catch those, so every order rendered "Not Shipped Yet". **(Note: this regex restoration was correct, but the actual reason matches still didn't surface in production was a separate cache-poisoning bug fixed in vJS5.24.)**
- The original false-positive bug ("DHL link on unshipped orders") stays fixed by the meta_data restriction `/track/i.test(meta.key)` shipped in vJS5.21 and still in place. Unshipped orders have no tracking notes, so their fake "DHL" links came from `meta_data` values (billing phones, payment intents). Restricting meta_data to track-keyed entries cuts that off regardless of regex permissiveness on the notes path.
- The truly broken `\b\d{8,22}\b` generic fallback stays deleted.
- Feature: Diagnostic logging in `getTrackingInfo()`. Successful matches now log `✅ Tracking #29954: <number> (<carrier>) [from note|meta '<key>']`. Misses on orders that have notes log `ℹ️ No tracking match for #29954 (notes=6, meta=42); first note sample: "..."` with the first 200 chars whitespace-collapsed. Lets us diagnose future "every order is Not Shipped Yet" failure modes from a single user-shared console log without instrumenting the code on demand.

### vJS5.22
- Bug fix: Reverts the `order.status === 'completed'` gate added in vJS5.21. The gate caused every order in the list to render as "Not Shipped Yet" — including orders with valid tracking notes — because QuikrStuff's actual fulfillment flow keeps shipped orders at `processing` (with the tracking note added) rather than transitioning them to `completed`. The vJS5.21 docstring described the intended workflow, not the observable one.
- Behavior: tracking-data presence is now the sole criterion. `getTrackingInfo()` returns the resolved tracking when notes/meta contain a carrier-named pattern, regardless of order status; `renderTrackingCell()` shows the carrier link when found, "Not Shipped Yet" when notes have been fetched and nothing matched, and "Loading..." while notes are still in flight. State machine collapses from four states to three.
- Why the original DHL false-positive bug stays fixed: the false-positive prevention shipped in vJS5.21 (tightened `extractTrackingFromText` regexes — stage-2 fallbacks restricted to USPS `9[234]…{17–22}`, UPS `1Z…{16}`, UPS `T\d{10}`; `getCarrierTrackingUrl` returning null for unknown providers; `meta_data` scan limited to keys matching `/track/i`) does not depend on the status gate. A `processing` order with a 10-digit billing phone and no real tracking note still resolves to null and renders "Not Shipped Yet" — same outcome the gate was reaching for, without rejecting legitimately-shipped orders.

### vJS5.21
- Bug fix: Tracking links no longer surface for orders that haven't shipped. `getTrackingInfo()` now gates strictly on `order.status === 'completed'` (per the operational convention "orders move to completed only after they ship") and returns null for any other status. Pending, processing, on-hold, cancelled, refunded, and failed orders are now guaranteed to skip extraction even when their notes contain tracking-shaped digits. **(Reverted in vJS5.22 — the gate caused every order to render as "Not Shipped Yet" because QuikrStuff's flow keeps shipped orders at `processing`, not `completed`.)**
- Bug fix: 10-digit numbers (customer phones, Unix timestamps, plugin numerics) no longer get classified as DHL tracking. `extractTrackingFromText()` dropped the stage-2 patterns that weren't shape-unique (`\b\d{10}\b -> DHL`, `\b\d{8,22}\b -> ''`, `\b\d{12}\b`/`\b\d{15}\b -> FedEx`). Carrier-shape-only fallbacks now keep just USPS `9[234]…{17–22}`, UPS `1Z…{16}`, and UPS `T\d{10}`. DHL Express AWBs (10 digits with no shape constraint) are now matched only when the carrier name "DHL" appears explicitly in the text.
- Bug fix: `getCarrierTrackingUrl()` no longer auto-classifies any 10-digit input as DHL or defaults unknown providers to USPS. Returns null for unknown providers; callers treat that as "no tracking".
- Bug fix: meta_data scan tightened. Was previously running the regex across every meta value (billing phones, payment intents, Stripe IDs). Now restricted to entries whose KEY contains "track" (case-insensitive), which covers WC Shipment Tracking / AfterShip / Ship Station style plugins without scanning unrelated values.
- Feature: New "Not Shipped Yet" UI state. The order list's tracking column previously showed "Loading..." (initial render) or "N/A" (post-fetch) when tracking didn't resolve. Both are now replaced with an explicit "Not Shipped Yet" label. Non-completed orders skip the wait entirely and render the terminal state on first paint instead of sitting at "Loading..." for a fetch that will never produce tracking.
- Refactor: Tracking-cell rendering is now centralized in a single `renderTrackingCell(cell, order, notesFetched)` helper. Both `displayOrdersList()` and `updateOrderDetailsUI()` delegate to it. Eliminates the copy-drift that produced the "Loading..." / "N/A" inconsistency in the first place.
- Security: Carrier links now include `rel="noopener noreferrer"` (target="_blank" without it lets the carrier page navigate the original tab via window.opener).
- Follow-up identified (not addressed in this release): `src/tracking.js` is dead code. Its functionality is duplicated and superseded inline in `src/app.js`, and its CommonJS Node-only imports prevent it from running in the browser bundle. Deferred to a later hygiene pass.

### vJS5.20
- Bug fix: Customer emails appearing only in CC or BCC fields now resolve correctly. The fallback parser previously checked only FROM and TO at both data and message-array levels; both now also check `cc_fields`/`bcc_fields` (long shape) and `msg.cc`/`msg.bcc` (short shape).
- Bug fix: Fixed a regression in `extractEmailFromParticipants` where `participants.find((p) => p.role === 'to')` returned only the first match; if that participant's email failed the customer filter, the second-or-later TO participant was never checked. Rewritten to filter() each role into a tier and iterate the entire tier before falling through.
- Feature: New `getCustomerEmailFromAPI()` uses the documented `Missive.getEmailAddresses(conversations)` (synchronous, returns `Array<AddressField>`) as the primary email-resolution path. The API already flattens FROM/TO/CC/BCC/reply_to across every message in the given conversations, so the first non-internal address is the customer. The shape-guessing parser is kept as a fallback for cached/offline payloads and older Missive clients.
- Refactor: Extracted the seven email-extraction helpers from `MissWooApp` into a standalone UMD module at `src/email-extract.js`. The class methods are now thin delegators (~424 lines moved out of `app.js`). Same byte-equivalent logic, but unit-testable directly under jest in node.
- Tests: New `__tests__/email-extract.test.js` with ~30 cases pinning behavior for all seven helpers, including dedicated regression tests for the CC-only, BCC-only, and multi-TO participant cases.
- Logging: One log per `processClickedConversation` resolution naming the source (`getEmailAddresses` vs `extractEmailFromData`) so future triage can immediately tell which path produced the result.

### vJS5.19
- Cleanup: Trimmed `integrations/missive-js/app.js` to the documented Missive JS API surface (~631 → ~167 lines)
- Cleanup: Removed listeners that never fire (`ready`, `error`, `email:open`, `thread:focus`, `conversation:focus`, `conversation:open`) — only `change:conversations` is used, matching the public API
- Cleanup: Removed undocumented method calls (`getCurrentConversation`, `getCurrentUser`, `getUsers`, `getTeams`, `getChannels`) and the `MissWooDebug` probes that referenced them
- Reliability: Replaced the 25×200ms poll + 2s fallback init dance with a single script `onload` listener and a 100ms poll capped at 2s
- Behavior preserved: `change:conversations` → `app.handleConversationChange` is unchanged

### vJS5.18
- Performance: Added size limits to Katana and serial number caches (200 entries each) to prevent unbounded memory growth
- Performance: Added LRU eviction for Katana and serial caches when size limits are reached
- Memory: Improved memory management with size-based cache limits in addition to time-based expiration

### vJS5.17
- Bug fix: Fixed serial numbers and tracking info not loading when using cached conversation data with expired email cache
- Bug fix: Added loadOrderDetails() call in performAutoSearch() to ensure background loading of order details

### vJS5.16
- Bug fix: Improved race condition handling by setting lastSearchedEmail early and improving display checks
- Bug fix: Prevent duplicate processing when clicking the same email multiple times
- Bug fix: Fixed _displayInProgress flag not being reset on early return
- Performance: Added check to skip duplicate searches when already displaying the same email

### vJS5.15
- Bug fix: Fixed race condition where incorrect data shows up when clicking through emails quickly
- Bug fix: Fixed issue where previous order data remained visible when "No orders found" is displayed
- UX: Clear old data immediately when starting new conversation to prevent stale data display

### vJS5.14
- Performance: Removed background loading of order details when conversation is closed
- Code cleanup: Removed dead code from background preloading (getPerformanceStats, logPerformanceStats)
- Optimization: Background loading now stops immediately when user navigates away from conversation

### vJS5.13
- Bug fix: Fixed stuck "Searching orders..." spinner when API returns empty array
- Fix: processClickedConversation() now calls displayOrdersList() when no orders found
- UX: Status now properly updates to "No orders found" instead of spinning indefinitely
- Critical: Resolves issue where some conversations would spin forever on "Searching orders..."

### vJS5.11
- Debug: Added comprehensive logging to diagnose "Searching orders..." spinner issue
- Debug: Added logs to track API search flow and displayOrdersList() calls
- Fix: Improved handling of empty order arrays from WooCommerce API
- Debug: Added visibility into when "No orders found" status is set

### vJS5.10
- Performance: Implemented background caching for cancelled searches
- UX: Results are now cached even when user clicks away from email
- Efficiency: Returning to previously searched emails loads instantly from cache
- Bug fix: Fixed "No orders found" only showing when API returns empty array or times out
- Bug fix: Fixed stuck "Searching orders..." spinner when searches are cancelled

### vJS5.09
- Performance: Removed unnecessary fallback timers that were causing CPU usage even when idle
- Resource efficiency: Integration now uses near-zero CPU when "No orders found" is displayed
- Memory: Added proper AbortController cleanup to prevent memory leaks
- Code quality: Eliminated redundant setTimeout calls from initialization

### vJS5.08
- Performance: Added 12-second timeout to search operations to prevent indefinite spinning
- UX: Search now shows "No orders found" after 12 seconds if API doesn't respond
- Reliability: Prevents hanging searches when WooCommerce API is slow or unresponsive
- Implementation: Timeout uses existing AbortController system for clean cancellation

### vJS5.07
- Performance: Removed 300ms debounce from performAutoSearch() - searches start immediately
- Performance: Removed 100ms debounce from conversation clicks - processes immediately
- Performance: Reduced wait-for-app loop from 5s to 500ms max
- Performance: Removed email:focus event binding (invalid API, was causing silent failures)
- Performance: Cleaned up redundant version badge setTimeouts
- Expected improvement: ~400ms faster per click-triggered search

### vJS5.06
- Performance: Parallelized notes + Katana fetching in loadOrderDetails()
- Performance: Parallelized sales export data checking
- Performance: Added loadOrderDetails() call in performAutoSearch() to fix missing data
- Performance: Start loadOrderDetails() immediately (don't await displayOrdersList())
- Code cleanup: Removed 326 lines of dead code (6 unused functions, 3 unused variables)
- Code cleanup: Removed all preloading logic and comments

### vJS5.05
- Performance: Consolidated cache lookups into single unified function
- Performance: Removed unused batching logic from disabled preloading code
- Code cleanup: Removed 192 lines of dead code (fetchConversationsOneByOne, commented preloading code)
- Code quality: Reduced redundant cache operations from 10+ to 1 function call

### vJS5.04
- Performance: Reduced cold-start time from ~10s to ~2s
- Performance: Lazy-load sales export data (only loads when needed for orders <= 19769)
- Performance: Web Worker for JSON parsing (non-blocking UI)
- Performance: localStorage caching with 24h TTL for sales export data
- Performance: Reduced Missive API polling timeout (3s → 2s)
- Performance: Parallelized initialization steps
- Performance: Added debouncing for Missive events (300ms)
- Performance: Added search result memoization (5min TTL)
- Code cleanup: Removed ~150 lines of dead code (unused functions, non-existent event listeners)
- Code cleanup: Removed email:focus event listener (doesn't exist in Missive API)
- Code cleanup: Removed unused background tasks system

### vJS5.03
- Fixed: Serial numbers and tracking information now load when searching by order ID
- Fixed: Added loadOrderDetails() call after getOrderById() to fetch serial numbers from sales export data

### vJS5.01

### vJS5.00

### vJS4.25

### vJS4.24

### vJS4.23

### vJS4.22

### vJS4.21

### vJS4.20

### vJS4.19

- **Fixed preloading API usage**: Changed from unsupported limit/sort parameters to conversation ID accumulation
- **API compliance**: Now uses correct `fetchConversations(idsArray)` format per official Missive API documentation
- **Improved preloading strategy**: Accumulates conversation IDs from `change:conversations` events and triggers bulk preload once 5+ IDs collected
- **Eliminated null responses**: Removed attempts to use unsupported limit/sort parameters that returned null

### vJS4.18

- **Bulk preloading for inbox**: Added automatic fetching and preloading of 15 most recent emails when inbox opens
- **Improved performance**: Preloads customer data for top 15 emails in background for faster access
- **Smart fetching**: Tries multiple API formats to ensure compatibility with different Missive API versions
- **Duplicate prevention**: Uses flag to prevent fetching recent conversations multiple times per session

### vJS4.17

- **API call optimization**: Added request deduplication to prevent duplicate Katana API calls
- **Performance improvement**: In-flight request tracking ensures each order is only fetched once, even with concurrent requests
- **Reduced API usage**: Eliminates redundant API calls when multiple code paths request the same order simultaneously
- **Better logging**: Added "Reusing in-flight request" messages to track when duplicate calls are prevented

### vJS4.16

- **Fixed serial number display for historical orders**: Added sales export data check to `batchGetSerialNumbers()` function
- **Improved data lookup flow**: Orders ≤ 19769 now check sales export data before attempting Katana API calls
- **Fixed missing serial numbers**: Resolved issue where serial numbers showed "N/A" for orders in JSON file
- **Performance optimization**: Batch serial number fetching now properly uses sales export data when available

### vJS4.15

- **Enhanced debugging for sales export data**: Added comprehensive logging to track data loading, lookup, and retrieval for historical orders
- **Fixed abort signal issue**: Removed abort signal from sales export data fetch during initialization to prevent loading failures
- **Improved data loading**: Added wait logic to ensure sales export data is loaded before attempting lookups
- **Better error handling**: Enhanced error messages and logging throughout the sales export data flow

### vJS4.14
- ✅ **Combined Sales Export Data**: Optimized sales_export_filtered.json structure - entries with same order number are now combined
- ✅ **Improved Data Structure**: Each order now has a single entry with combined SerialNumbers and Keys arrays
- ✅ **Better Performance**: Reduced file size and faster lookups with combined data structure

### vJS4.13
- ✅ **Historical Sales Data Integration**: Added support for sales export data for older orders (≤ 19769)
- ✅ **Serial Number Fallback**: Orders ≤ 19769 now use sales_export_filtered.json for serial numbers and keys
- ✅ **Key Number Display**: Key numbers from sales export data are now displayed alongside serial numbers
- ✅ **Improved Data Access**: Historical order data loads on initialization for fast lookup

### vJS4.12
- ✅ **Preloading Optimization**: Preload only first 15 emails when inbox opens for faster data access
- ✅ **Reduced Debounce**: Reduced preloading debounce from 500ms to 250ms for faster response
- ✅ **Performance**: Focuses preloading on most commonly accessed emails at top of inbox

### vJS4.10
- ✅ Fixed critical memory leak: Event listener removal now works properly
- ✅ Fixed undefined property error: `visibleEmails` now properly initialized
- ✅ Added missing timer cleanup: `conversationChangeDebounceTimer` now cleaned up
- ✅ Improved event listener management: Stored bound function references for proper cleanup

### vJS4.09
- ✅ JavaScript performance optimizations for faster search:
  - Early termination in filterOrdersByEmail (stops at 5 matches)
  - Reduced excessive logging in hot paths (cache hits, API responses)
  - Cached base URL construction to avoid repeated string operations
  - Streamlined cache hit path for minimal processing overhead
  - Removed unnecessary array operations and logging statements

### vJS4.08
- ✅ Fixed email normalization for consistent cache lookups
- ✅ Preloaded/cached data now properly retrieved when clicking emails
- ✅ Eliminated "Searching orders..." when data is already cached
- ✅ Improved cache hit rate with normalized email matching

### vJS4.07
- ✅ JavaScript performance optimizations for faster search:
  - Early termination in filterOrdersByEmail (stops at 5 matches)
  - Reduced excessive logging in hot paths (cache hits, API responses)
  - Cached base URL construction to avoid repeated string operations
  - Streamlined cache hit path for minimal processing overhead
  - Removed unnecessary array operations and logging statements

### vJS4.07
- ✅ Enhanced preloading to fetch ALL visible inbox conversations
- ✅ Improved fetchConversations API handling with Promise-based pattern
- ✅ Increased maxPreloadedConversations limit to 50
- ✅ Better error handling and batch processing for conversation fetching

### vJS4.06
- ✅ Version bump to force cache refresh in Missive

### vJS4.05
- ✅ Performance optimizations for preloading system:
  - Added debouncing (500ms) to conversation change events to prevent rapid-fire API calls
  - Implemented cache size limits with LRU eviction (100 emailCache, 50 preloadedConversations)
  - Added prioritization system to preload current conversation first
  - Enhanced error recovery with automatic retry for failed preloads
  - Improved memory management to prevent unbounded cache growth

### vJS4.04
- ✅ Automatic preloading of all visible emails: Enhanced Missive integration to automatically detect and preload customer details for all visible conversations via `change:conversations` event

### vJS4.03
- ✅ Improved cache persistence: Cache now persists throughout user session until navigation away

### vJS4.02
- ✅ Enhanced preloading: Preloads all customer details (orders, notes, Katana data, serial numbers) for all visible emails

### vJS4.01
- ✅ Restored all four performance optimizations:
  - OPTIMIZATION 1: Parallelize Katana API calls (batch fetching)
  - OPTIMIZATION 2: Parallelize WooCommerce page fetching with early termination
  - OPTIMIZATION 3: Defer order notes fetching (lazy loading)
  - OPTIMIZATION 4: Add request cancellation (AbortController support)

### vJS4.00
- ✅ Updated to use correct Missive JavaScript API methods
- ✅ Changed primary method from fetchMessages to fetchConversations
- ✅ Enhanced conversation data extraction with proper API structure
- ✅ Improved error handling and fallback mechanisms

### vJS3.55
- ✅ Added Missive-specific email extraction based on official API documentation
- ✅ Implemented from_field.address and to_fields[].address handling
- ✅ Enhanced recursive email search with comprehensive debugging
- ✅ Added testEmailExtractionWithData() debug method

### vJS3.54
- ✅ Enhanced email extraction with recursive search
- ✅ Added searchForEmailsRecursively() method
- ✅ Improved email detection in nested objects and arrays
- ✅ Added extractAllEmailsFromString() method

### v2.0
- ✅ Fixed GitHub Pages deployment paths
- ✅ Improved Missive environment detection
- ✅ Added aggressive loading state clearing
- ✅ Enhanced error handling and debugging
- ✅ Added `change:conversations` event listener
- ✅ Simplified configuration management

### v1.0
- Initial release with basic WooCommerce integration
- Manual search functionality
- Basic Missive integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally using `index-dev.html`
5. Submit a pull request

## 📄 License

This project is proprietary software for QuikrStuff integration with Missive.
