/**
 * Miss-Woo API — Cloudflare Worker ("the middleman")
 *
 * Holds the WooCommerce and Katana keys so the Missive sidebar never sees them.
 * Read-only: it only ever makes GET requests to WooCommerce and Katana.
 *
 * Secrets (Cloudflare → Worker → Settings → Variables and Secrets, type "Secret"):
 *   WC_CONSUMER_KEY     WooCommerce REST key (Read permission)
 *   WC_CONSUMER_SECRET  WooCommerce REST secret
 *   KATANA_API_KEY      Katana API key
 *   ACCESS_TOKEN        Long random "pass" the sidebar must send
 * Optional plain-text variables:
 *   WC_BASE_URL         default https://quikrstuff.com/wp-json/wc/v3
 *   ALLOWED_ORIGINS     comma-separated sites allowed to call this from a browser
 *                       default https://quikrstuff.github.io
 *   ORDER_STATUSES      which WooCommerce order statuses customer lookups return
 *                       default processing,completed,pending (hides failed/cancelled/on-hold etc.)
 * Bindings (Cloudflare → Worker → Settings → Bindings):
 *   LEGACY_ORDERS       KV namespace with the historical sales export (older orders' rack serial
 *                       numbers and lock key numbers), stored as one entry "orders-v1":
 *                       {"v":1,"count":N,"orders":{"<order no>":[[serials...],[keys...]]}}
 *                       This data is private: it lives only in Cloudflare, never in the repo.
 *
 * Routes:
 *   GET /health                               no pass needed; shows it is running and which secrets are set
 *   GET /api/ping                             checks WooCommerce + Katana keys work
 *   GET /api/orders/by-email?email=a,b        recent orders for one or more customer emails (up to 4), with notes
 *   GET /api/orders/search?q=&page=           name/free-text search (slow, WooCommerce search)
 *   GET /api/orders/:id                       one order, with notes
 *   GET /api/orders/:id/notes                 an order's notes
 *   GET /api/katana/order?order_no=           Katana sales order + serial numbers for one Woo order number
 *   GET /api/legacy/order?order_no=           historical serial numbers + lock key numbers for ONE older order
 * Pass the pass as header "X-MissWoo-Token" or as ?token= . Add &fresh=1 to skip the cache.
 */

const VERSION = 'api-1.5.0';

const TTL = {
  orders: 5 * 60 * 1000, // order lists and single orders: 5 minutes
  katana: 15 * 60 * 1000, // Katana orders + serials: 15 minutes
  search: 2 * 60 * 1000, // free-text search: 2 minutes
};
const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_ORDERS = 10;
const MAX_EMAILS = 4; // a conversation can include several customer addresses
const DEFAULT_ORDER_STATUSES = 'processing,completed,pending';

// Best-effort memory shared by requests that land on the same Cloudflare server.
const memo = new Map();
const MEMO_MAX = 500;

export default {
  // Times every request and writes one log line per request (no emails or
  // other customer details are logged: only routes, durations and statuses).
  async fetch(request, env) {
    const started = Date.now();
    const trace = { calls: [], cache: 'none' };
    const response = await handle(request, { ...env, __trace: trace });
    const totalMs = Date.now() - started;
    const route = new URL(request.url).pathname.replace(/\/\d+/g, '/:id');
    if (route.startsWith('/api/')) {
      console.log(JSON.stringify({
        timing: true, route, status: response.status, total_ms: totalMs, cache: trace.cache,
        upstream_ms: trace.calls.reduce((n, c) => n + c.ms, 0), calls: trace.calls,
      }));
    }
    const headers = new Headers(response.headers);
    headers.set('Server-Timing', `total;dur=${totalMs}, cache;desc="${trace.cache}"`);
    headers.append('Access-Control-Expose-Headers', 'Server-Timing');
    return new Response(response.body, { status: response.status, headers });
  },
};

async function handle(request, env) {
  {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, cors);

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        return json({
          ok: true,
          version: VERSION,
          secrets_set: {
            WC_CONSUMER_KEY: !!env.WC_CONSUMER_KEY,
            WC_CONSUMER_SECRET: !!env.WC_CONSUMER_SECRET,
            KATANA_API_KEY: !!env.KATANA_API_KEY,
            ACCESS_TOKEN: !!env.ACCESS_TOKEN,
          },
          // Only a count (never the data itself), so this public page shows the history loaded.
          legacy_orders: await legacyStatus(env),
        }, 200, cors);
      }

      if (!url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404, cors);
      if (!(await isAuthorized(request, url, env))) return json({ error: 'unauthorized' }, 401, cors);

      const fresh = url.searchParams.get('fresh') === '1';
      const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

      if (parts[1] === 'ping') return json(await ping(env), 200, cors);

      if (parts[1] === 'orders' && parts[2] === 'by-email') {
        const emails = [...new Set(String(url.searchParams.get('email') || '')
          .split(',').map(normalizeEmail).filter(Boolean))].slice(0, MAX_EMAILS);
        if (!emails.length) return json({ error: 'bad_request', detail: 'A valid email is required.' }, 400, cors);
        const withNotes = url.searchParams.get('notes') !== '0';
        const data = await cached(env, `email:${emails.join(',')}:${withNotes}`, TTL.orders, fresh,
          () => ordersByEmail(env, emails, withNotes));
        return json(data, 200, cors);
      }

      if (parts[1] === 'orders' && parts[2] === 'search') {
        const q = (url.searchParams.get('q') || '').trim();
        if (q.length < 2) return json({ error: 'bad_request', detail: 'Search text is too short.' }, 400, cors);
        const page = clampInt(url.searchParams.get('page'), 1, 10, 1);
        const data = await cached(env, `search:${q.toLowerCase()}:${page}`, TTL.search, fresh,
          () => woo(env, '/orders', {
            search: q, status: orderStatuses(env).join(','), per_page: 100, page, orderby: 'date', order: 'desc',
          }));
        return json(data, 200, cors);
      }

      if (parts[1] === 'orders' && /^\d+$/.test(parts[2] || '')) {
        const id = parts[2];
        if (parts[3] === 'notes') {
          return json(await cached(env, `notes:${id}`, TTL.orders, fresh, () => woo(env, `/orders/${id}/notes`)), 200, cors);
        }
        if (!parts[3]) {
          const data = await cached(env, `order:${id}`, TTL.orders, fresh, async () => {
            const order = await woo(env, `/orders/${id}`);
            order.notes = await woo(env, `/orders/${id}/notes`).catch(() => []);
            return order;
          });
          return json(data, 200, cors);
        }
      }

      if (parts[1] === 'katana' && parts[2] === 'order') {
        const orderNo = (url.searchParams.get('order_no') || '').trim();
        if (!/^[\w-]{1,40}$/.test(orderNo)) return json({ error: 'bad_request', detail: 'order_no is required.' }, 400, cors);
        const data = await cached(env, `katana:${orderNo}`, TTL.katana, fresh, () => katanaOrderWithSerials(env, orderNo));
        return json(data, 200, cors);
      }

      if (parts[1] === 'legacy' && parts[2] === 'order' && !parts[3]) {
        const orderNo = (url.searchParams.get('order_no') || '').trim();
        if (!/^\d{1,10}$/.test(orderNo)) return json({ error: 'bad_request', detail: 'order_no must be a number.' }, 400, cors);
        let index;
        try {
          index = await loadLegacyIndex(env);
        } catch (err) {
          return json({ error: 'legacy_unavailable', detail: String(err.message || err) }, 503, cors);
        }
        // Compare as plain numbers so "0123" and "123" match the same order.
        const key = String(Number(orderNo));
        const record = index.orders.get(key) || null;
        return json({
          order_no: key,
          found: !!record,
          serial_numbers: record ? record.serials : [],
          keys: record ? record.keys : [],
        }, 200, cors);
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      return json({ error: 'upstream_error', detail: String(err.message || err) }, status, cors);
    }
  }
}

// ---------- WooCommerce ----------

async function ordersByEmail(env, emails, withNotes) {
  // Fastest path: the Miss-Woo WordPress add-on (wordpress/miss-woo-fast-lookup.php)
  // returns orders + notes in ONE request. Used automatically once it is installed.
  if (withNotes) {
    const fast = await fastLookup(env, emails);
    if (fast) return fast;
  }

  const statuses = orderStatuses(env).join(',');
  const emailSet = new Set(emails);

  // 1) Fast path: find each address's customer account by exact email (in parallel).
  const customerLists = await Promise.all(
    emails.map((email) => woo(env, '/customers', { email, role: 'all', per_page: 5 }).catch(() => []))
  );
  const customerIds = [...new Set(customerLists.flat().map((c) => c?.id).filter(Boolean))];

  const orderLists = await Promise.all(customerIds.map((customer) => woo(env, '/orders', {
    customer, status: statuses, per_page: MAX_ORDERS, orderby: 'date', order: 'desc',
  })));
  let orders = orderLists.flat();
  let source = orders.length ? 'customer' : 'none';

  // 2) Backup: no account orders for these addresses (old orders, or a different
  //    address typed on the order). One lighter WooCommerce search per address.
  if (!orders.length) {
    const found = await Promise.all(emails.map((email) => woo(env, '/orders', {
      search: email, status: statuses, per_page: 25, orderby: 'date', order: 'desc',
    }).catch(() => [])));
    orders = found.flat().filter((o) => emailSet.has(normalizeEmail(o?.billing?.email)));
    if (orders.length) source = 'search';
  }

  // Remove duplicates, keep allowed statuses only, newest first.
  const allowed = orderStatuses(env);
  const byId = new Map();
  for (const o of orders) if (o && allowed.includes(o.status)) byId.set(o.id, o);
  orders = [...byId.values()]
    .sort((a, b) => String(b.date_created || '').localeCompare(String(a.date_created || '')))
    .slice(0, MAX_ORDERS);

  if (withNotes && orders.length) {
    await mapLimit(orders, 5, async (o) => {
      o.notes = await woo(env, `/orders/${o.id}/notes`).catch(() => []);
    });
  }

  return {
    email: emails[0],
    emails,
    source,
    customer_id: customerIds[0] || null,
    customer_ids: customerIds,
    orders,
  };
}

// Remembers for 10 minutes that the add-on isn't installed, so we don't keep asking.
let fastUnavailableUntil = 0;

async function fastLookup(env, emails) {
  if (Date.now() < fastUnavailableUntil) return null;
  const base = (env.WC_BASE_URL || 'https://quikrstuff.com/wp-json/wc/v3').replace(/\/$/, '');
  const u = new URL(base.replace(/\/wc\/v3$/, '/wc-quikrstuff/v1') + '/orders-by-email');
  u.searchParams.set('email', emails.join(','));
  u.searchParams.set('statuses', orderStatuses(env).join(','));
  u.searchParams.set('limit', String(MAX_ORDERS));
  u.searchParams.set('consumer_key', env.WC_CONSUMER_KEY || '');
  u.searchParams.set('consumer_secret', env.WC_CONSUMER_SECRET || '');
  try {
    const data = await upstreamJson(env, u.toString(), { headers: { Accept: 'application/json' } }, 'WooCommerce');
    const allowed = orderStatuses(env);
    const orders = (Array.isArray(data?.orders) ? data.orders : []).filter((o) => allowed.includes(o?.status));
    const customerIds = Array.isArray(data?.customer_ids) ? data.customer_ids : [];
    return {
      email: emails[0], emails, source: 'fast', customer_id: customerIds[0] || null, customer_ids: customerIds, orders,
    };
  } catch (err) {
    // 404 = add-on not installed yet. Any other problem: use the normal path this time.
    if (err.status === 404) fastUnavailableUntil = Date.now() + 10 * 60 * 1000;
    return null;
  }
}

async function woo(env, path, params = {}) {
  const base = (env.WC_BASE_URL || 'https://quikrstuff.com/wp-json/wc/v3').replace(/\/$/, '');
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  // Keys go from this server straight to your site over HTTPS; never to the browser.
  u.searchParams.set('consumer_key', env.WC_CONSUMER_KEY || '');
  u.searchParams.set('consumer_secret', env.WC_CONSUMER_SECRET || '');
  return upstreamJson(env, u.toString(), { headers: { Accept: 'application/json' } }, 'WooCommerce');
}

// ---------- Katana ----------

async function katanaOrderWithSerials(env, orderNo) {
  const list = await katana(env, '/sales_orders', { order_no: orderNo });
  let order = list?.data?.[0] || null;
  if (!order) return { order_no: orderNo, katana_order: null, serials_by_row: {}, serial_numbers: [] };

  // Only fetch the full order if the list result did not include its rows.
  if (!Array.isArray(order.sales_order_rows)) {
    order = (await katana(env, `/sales_orders/${order.id}`).catch(() => null)) || order;
  }

  const rows = Array.isArray(order.sales_order_rows) ? order.sales_order_rows : [];
  const serialsByRow = {};
  await mapLimit(rows, 3, async (row) => {
    const res = await katana(env, '/serial_numbers', { resource_id: row.id, resource_type: 'SalesOrderRow' });
    serialsByRow[row.id] = (res?.data || []).map((s) => s.serial_number).filter(Boolean);
  });

  return {
    order_no: orderNo,
    katana_order: order,
    serials_by_row: serialsByRow,
    serial_numbers: Object.values(serialsByRow).flat(),
  };
}

async function katana(env, path, params = {}) {
  const u = new URL('https://api.katanamrp.com/v1' + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return upstreamJson(env, u.toString(), {
    headers: { Authorization: `Bearer ${env.KATANA_API_KEY || ''}`, Accept: 'application/json' },
  }, 'Katana');
}

async function ping(env) {
  const result = { woocommerce: 'unknown', katana: 'unknown' };
  await Promise.all([
    woo(env, '/orders', { per_page: 1, _fields: 'id' })
      .then(() => { result.woocommerce = 'ok'; })
      .catch((e) => { result.woocommerce = `error: ${e.message}`; }),
    katana(env, '/sales_orders', { limit: 1 })
      .then(() => { result.katana = 'ok'; })
      .catch((e) => { result.katana = `error: ${e.message}`; }),
  ]);
  return result;
}

// ---------- Historical sales export (older orders) ----------

const LEGACY_KEY = 'orders-v1';
const LEGACY_TTL_MS = 60 * 60 * 1000; // re-read from Cloudflare storage at most once an hour per server
const LEGACY_RETRY_MS = 60 * 1000; // after a failed read, wait a minute before trying storage again
let legacyCache = null; // { index, expires }
let legacyLoading = null; // shared promise while a read is in progress
let legacyFailure = null; // { error, until } after a failed read

// Reads the whole index, checks it, tidies every record, and keeps it in memory.
// - A failed read is not kept, but storage is not asked again for a minute
//   (so the public /health page can't trigger a storage read on every visit).
// - If an hourly refresh fails, the last good copy keeps being used.
async function loadLegacyIndex(env) {
  if (!env.LEGACY_ORDERS || typeof env.LEGACY_ORDERS.get !== 'function') {
    throw new Error('LEGACY_ORDERS storage is not connected to this worker.');
  }
  const now = Date.now();
  if (legacyCache && legacyCache.expires > now) return legacyCache.index;
  if (legacyFailure && legacyFailure.until > now) {
    if (legacyCache) return legacyCache.index; // stale but good
    throw legacyFailure.error;
  }
  if (!legacyLoading) {
    legacyLoading = readLegacyIndex(env)
      .then((index) => {
        legacyCache = { index, expires: Date.now() + LEGACY_TTL_MS };
        legacyFailure = null;
        return index;
      })
      .catch((error) => {
        legacyFailure = { error, until: Date.now() + LEGACY_RETRY_MS };
        // Entry deleted on purpose (e.g. to take the data offline): forget the old copy too.
        if (error.code === 'missing') legacyCache = null;
        if (legacyCache) return legacyCache.index; // stale but good (temporary storage problem)
        throw error;
      })
      .finally(() => { legacyLoading = null; });
  }
  return legacyLoading;
}

async function readLegacyIndex(env) {
  const raw = await env.LEGACY_ORDERS.get(LEGACY_KEY, { type: 'text' });
  if (raw == null) {
    const err = new Error(`Entry "${LEGACY_KEY}" was not found in LEGACY_ORDERS.`);
    err.code = 'missing';
    throw err;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Entry "${LEGACY_KEY}" is not valid JSON.`);
  }
  if (!data || data.v !== 1 || !data.orders || typeof data.orders !== 'object' || Array.isArray(data.orders)) {
    throw new Error(`Entry "${LEGACY_KEY}" is not in the expected format.`);
  }
  // Tidy once at load time: order numbers as plain numbers ("0042" -> "42"),
  // serials and keys as non-empty text. Records that aren't lists are skipped.
  const text = (v) => (Array.isArray(v)
    ? v.filter((x) => (typeof x === 'string' || typeof x === 'number') && String(x).trim()).map((x) => String(x).trim())
    : []);
  const orders = new Map();
  for (const [rawKey, rec] of Object.entries(data.orders)) {
    if (!/^\d{1,10}$/.test(rawKey.trim()) || !Array.isArray(rec)) continue;
    const k = String(Number(rawKey.trim()));
    const prev = orders.get(k);
    if (prev) { // "42" and "042" are the same order: combine, don't overwrite
      prev.serials.push(...text(rec[0]));
      prev.keys.push(...text(rec[1]));
      continue;
    }
    orders.set(k, { serials: text(rec[0]), keys: text(rec[1]) });
  }
  return { orders, count: orders.size };
}

// For /health: a number when loaded, otherwise a short reason. Never the data.
async function legacyStatus(env) {
  if (!env.LEGACY_ORDERS) return 'not_connected';
  try {
    return (await loadLegacyIndex(env)).count;
  } catch {
    return 'error';
  }
}

// ---------- helpers ----------

async function upstreamJson(env, urlString, init, label) {
  // Path only (no query string), so no emails or keys end up in the logs.
  const path = new URL(urlString).pathname.replace(/\/\d+/g, '/:id').replace('/wp-json/wc/v3', '');
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    const res = await fetch(urlString, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
      .catch((e) => {
        const err = new Error(`${label} did not answer in time (${e.name})`);
        err.status = 504;
        throw err;
      });
    const body = res.ok ? await res.json() : null;
    env.__trace?.calls.push({ api: label, path, ms: Date.now() - t0, status: res.status });
    if (res.ok) return body;

    // One retry if the service says "slow down" or has a hiccup.
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      const wait = Math.min(Number(res.headers.get('Retry-After')) || 1, 5) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const err = new Error(`${label} returned HTTP ${res.status}`);
    err.status = res.status === 401 || res.status === 403 ? 502 : res.status;
    throw err;
  }
}

// Only successful answers are remembered; failures are never cached.
async function cached(env, key, ttl, fresh, loader) {
  const hit = memo.get(key);
  if (!fresh && hit && hit.expires > Date.now()) {
    if (env.__trace) env.__trace.cache = 'hit';
    return hit.value;
  }
  if (env.__trace) env.__trace.cache = 'miss';
  const value = await loader();
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
  memo.set(key, { value, expires: Date.now() + ttl });
  return value;
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

async function isAuthorized(request, url, env) {
  const expected = env.ACCESS_TOKEN || '';
  const given = request.headers.get('X-MissWoo-Token') || url.searchParams.get('token') || '';
  if (expected.length < 20 || given.length !== expected.length) return false;
  const enc = new TextEncoder();
  return crypto.subtle.timingSafeEqual(enc.encode(given), enc.encode(expected));
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://quikrstuff.github.io')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-MissWoo-Token, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

function orderStatuses(env) {
  return String(env.ORDER_STATUSES || DEFAULT_ORDER_STATUSES)
    .split(',').map((s) => s.trim().toLowerCase().replace(/^wc-/, '')).filter(Boolean);
}

function normalizeEmail(value) {
  const e = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}
