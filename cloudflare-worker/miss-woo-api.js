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
 *                       default https://bryanquikrstuff.github.io
 *   ORDER_STATUSES      which WooCommerce order statuses customer lookups return
 *                       default processing,completed,pending (hides failed/cancelled/on-hold etc.)
 *
 * Routes:
 *   GET /health                               no pass needed; shows it is running and which secrets are set
 *   GET /api/ping                             checks WooCommerce + Katana keys work
 *   GET /api/orders/by-email?email=           a customer's recent orders, with notes (fast account lookup)
 *   GET /api/orders/search?q=&page=           name/free-text search (slow, WooCommerce search)
 *   GET /api/orders/:id                       one order, with notes
 *   GET /api/orders/:id/notes                 an order's notes
 *   GET /api/katana/order?order_no=           Katana sales order + serial numbers for one Woo order number
 * Pass the pass as header "X-MissWoo-Token" or as ?token= . Add &fresh=1 to skip the cache.
 */

const VERSION = 'api-1.1.1';

const TTL = {
  orders: 5 * 60 * 1000, // order lists and single orders: 5 minutes
  katana: 15 * 60 * 1000, // Katana orders + serials: 15 minutes
  search: 2 * 60 * 1000, // free-text search: 2 minutes
};
const UPSTREAM_TIMEOUT_MS = 15000;
const MAX_ORDERS = 10;
const DEFAULT_ORDER_STATUSES = 'processing,completed,pending';

// Best-effort memory shared by requests that land on the same Cloudflare server.
const memo = new Map();
const MEMO_MAX = 500;

export default {
  async fetch(request, env) {
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
        }, 200, cors);
      }

      if (!url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404, cors);
      if (!(await isAuthorized(request, url, env))) return json({ error: 'unauthorized' }, 401, cors);

      const fresh = url.searchParams.get('fresh') === '1';
      const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

      if (parts[1] === 'ping') return json(await ping(env), 200, cors);

      if (parts[1] === 'orders' && parts[2] === 'by-email') {
        const email = normalizeEmail(url.searchParams.get('email'));
        if (!email) return json({ error: 'bad_request', detail: 'A valid email is required.' }, 400, cors);
        const withNotes = url.searchParams.get('notes') !== '0';
        const data = await cached(`email:${email}:${withNotes}`, TTL.orders, fresh,
          () => ordersByEmail(env, email, withNotes));
        return json(data, 200, cors);
      }

      if (parts[1] === 'orders' && parts[2] === 'search') {
        const q = (url.searchParams.get('q') || '').trim();
        if (q.length < 2) return json({ error: 'bad_request', detail: 'Search text is too short.' }, 400, cors);
        const page = clampInt(url.searchParams.get('page'), 1, 10, 1);
        const data = await cached(`search:${q.toLowerCase()}:${page}`, TTL.search, fresh,
          () => woo(env, '/orders', {
            search: q, status: orderStatuses(env).join(','), per_page: 100, page, orderby: 'date', order: 'desc',
          }));
        return json(data, 200, cors);
      }

      if (parts[1] === 'orders' && /^\d+$/.test(parts[2] || '')) {
        const id = parts[2];
        if (parts[3] === 'notes') {
          return json(await cached(`notes:${id}`, TTL.orders, fresh, () => woo(env, `/orders/${id}/notes`)), 200, cors);
        }
        if (!parts[3]) {
          const data = await cached(`order:${id}`, TTL.orders, fresh, async () => {
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
        const data = await cached(`katana:${orderNo}`, TTL.katana, fresh, () => katanaOrderWithSerials(env, orderNo));
        return json(data, 200, cors);
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      return json({ error: 'upstream_error', detail: String(err.message || err) }, status, cors);
    }
  },
};

// ---------- WooCommerce ----------

async function ordersByEmail(env, email, withNotes) {
  // 1) Fast path: every QuikrStuff customer has an account, so find it by exact email.
  const customers = await woo(env, '/customers', { email, role: 'all', per_page: 5 });
  let orders = [];
  let source = 'none';
  let customerId = null;

  if (Array.isArray(customers) && customers.length > 0) {
    customerId = customers[0].id;
    orders = await woo(env, '/orders', {
      customer: customerId, status: orderStatuses(env).join(','),
      per_page: MAX_ORDERS, orderby: 'date', order: 'desc',
    });
    source = 'customer';
  }

  // 2) Backup: no account with that email (e.g. old orders, or the customer used
  //    a different address on the order). One lighter WooCommerce search.
  if (!orders.length) {
    const found = await woo(env, '/orders', {
      search: email, status: orderStatuses(env).join(','), per_page: 25, orderby: 'date', order: 'desc',
    });
    orders = (Array.isArray(found) ? found : [])
      .filter((o) => normalizeEmail(o?.billing?.email) === email)
      .slice(0, MAX_ORDERS);
    if (orders.length) source = 'search';
  }

  // Belt and braces: drop any status not on the list.
  const allowed = orderStatuses(env);
  orders = (Array.isArray(orders) ? orders : []).filter((o) => allowed.includes(o?.status));

  if (withNotes && orders.length) {
    await mapLimit(orders, 5, async (o) => {
      o.notes = await woo(env, `/orders/${o.id}/notes`).catch(() => []);
    });
  }

  return { email, source, customer_id: customerId, orders };
}

async function woo(env, path, params = {}) {
  const base = (env.WC_BASE_URL || 'https://quikrstuff.com/wp-json/wc/v3').replace(/\/$/, '');
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  // Keys go from this server straight to your site over HTTPS; never to the browser.
  u.searchParams.set('consumer_key', env.WC_CONSUMER_KEY || '');
  u.searchParams.set('consumer_secret', env.WC_CONSUMER_SECRET || '');
  return upstreamJson(u.toString(), { headers: { Accept: 'application/json' } }, 'WooCommerce');
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
  return upstreamJson(u.toString(), {
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

// ---------- helpers ----------

async function upstreamJson(urlString, init, label) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(urlString, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
      .catch((e) => {
        const err = new Error(`${label} did not answer in time (${e.name})`);
        err.status = 504;
        throw err;
      });
    if (res.ok) return res.json();

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
async function cached(key, ttl, fresh, loader) {
  const hit = memo.get(key);
  if (!fresh && hit && hit.expires > Date.now()) return hit.value;
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
  const allowed = (env.ALLOWED_ORIGINS || 'https://bryanquikrstuff.github.io')
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
