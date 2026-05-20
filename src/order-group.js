/**
 * Order-grouping helper used by the name-search path in `src/app.js`.
 *
 * `groupOrdersByCustomer(orders)` is pure (no DOM, no `this`, no
 * module-level state) so it can be unit-tested directly under jest in
 * node, while still being loadable as a plain `<script>` tag in the
 * browser via the UMD wrapper at the bottom of this file.
 *
 * Mirrors the pattern established by `src/email-extract.js`.
 *
 * Public API (mirrored on `window.OrderGroup` in the browser):
 *   - groupOrdersByCustomer(orders) -> { customers, truncated }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OrderGroup = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  // Cap the picker at 5 customers. Same shape as the existing 5-order cap
  // in `filterOrdersByEmail` - keeps the UI scannable and bounds the
  // detail-fetch fan-out the user might trigger afterwards. If more than
  // 5 distinct customers matched, we surface `truncated: true` so the UI
  // can show "Showing 5 most recent - refine your search".
  var MAX_CUSTOMERS = 5;

  /**
   * Group a flat list of WooCommerce orders into one entry per distinct
   * customer, keyed by normalized billing email.
   *
   * @param {Array<object>} orders Raw orders from WooCommerce `/orders?search=`.
   *   Each order is expected to have `billing.email`, `billing.first_name`,
   *   `billing.last_name`, and `date_created`. Orders missing a billing
   *   email are skipped (the picker cannot route to them).
   * @returns {{
   *   customers: Array<{
   *     email: string,           // normalized lowercase
   *     displayName: string,     // "First Last" from most-recent order
   *     orderCount: number,
   *     mostRecentDate: string,  // ISO date_created from the newest order
   *     orders: Array<object>,   // every order in this group, original order
   *   }>,
   *   truncated: boolean,        // true if more than MAX_CUSTOMERS matched
   * }}
   */
  function groupOrdersByCustomer(orders) {
    if (!Array.isArray(orders) || orders.length === 0) {
      return { customers: [], truncated: false };
    }

    var groups = Object.create(null);
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      var email = normalizeEmail(o && o.billing && o.billing.email);
      if (!email) continue;

      if (!groups[email]) {
        groups[email] = {
          email: email,
          displayName: buildDisplayName(o.billing),
          orderCount: 0,
          mostRecentDate: o.date_created || '',
          orders: [],
          _mostRecentBilling: o.billing,
        };
      }

      var group = groups[email];
      group.orders.push(o);
      group.orderCount += 1;

      if (o.date_created && o.date_created > group.mostRecentDate) {
        group.mostRecentDate = o.date_created;
        group._mostRecentBilling = o.billing;
        group.displayName = buildDisplayName(o.billing);
      }
    }

    var customers = [];
    for (var key in groups) {
      var g = groups[key];
      delete g._mostRecentBilling;
      customers.push(g);
    }

    customers.sort(function (a, b) {
      if (a.mostRecentDate < b.mostRecentDate) return 1;
      if (a.mostRecentDate > b.mostRecentDate) return -1;
      return 0;
    });

    var truncated = customers.length > MAX_CUSTOMERS;
    if (truncated) customers = customers.slice(0, MAX_CUSTOMERS);

    return { customers: customers, truncated: truncated };
  }

  function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return null;
    var trimmed = email.trim().toLowerCase();
    return trimmed || null;
  }

  function buildDisplayName(billing) {
    if (!billing) return '';
    var first = typeof billing.first_name === 'string' ? billing.first_name.trim() : '';
    var last = typeof billing.last_name === 'string' ? billing.last_name.trim() : '';
    if (first && last) return first + ' ' + last;
    return first || last || '';
  }

  return {
    groupOrdersByCustomer: groupOrdersByCustomer,
  };
}));
