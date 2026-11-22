# Miss-Woo

Miss-Woo is QuikrStuff's sidebar app for [Missive](https://missiveapp.com). When a customer service agent opens a conversation, the sidebar shows that customer's WooCommerce orders, tracking numbers and Katana serial numbers.

## How it fits together

| Piece | Where it lives | Holds keys? | How it's updated |
|---|---|---|---|
| **Sidebar** (what agents see) | This repo, published to `https://quikrstuff.github.io/Miss-Woo/` | No | Merge a pull request into `main`. The **CI Pipeline** GitHub Action publishes it in about 2 minutes. |
| **Middleman** (Cloudflare Worker `miss-woo-api`) | `cloudflare-worker/miss-woo-api.js` (source copy) | Yes, as Cloudflare secrets | Paste the code into the Cloudflare editor and click **Deploy**. GitHub does **not** deploy it. |
| **Fast lookup add-on** (optional WordPress must-use plugin) | `wordpress/miss-woo-fast-lookup.php` (source copy) | No | Installed on quikrstuff.com by the site's web developer. |

The sidebar never sees the WooCommerce or Katana keys. It sends a pass (the `ACCESS_TOKEN`) to the middleman, and the middleman makes **read-only** requests to WooCommerce and Katana.

```
Missive sidebar  ──(pass)──▶  Cloudflare Worker  ──(keys, read-only)──▶  WooCommerce / Katana
```

## What agents see

- Orders for every customer email in the conversation (up to 4). Internal @quikrstuff.com addresses are skipped.
- Only **processing**, **completed** and **pending** orders in customer lookups. Looking up a specific order number shows it whatever its status.
- Tracking numbers (from order notes) and Katana serial numbers for each order.

## Repo layout

| Path | What it is |
|---|---|
| `index.html`, `index-web.html` | Sidebar pages |
| `src/` | Sidebar code (`config.js` holds no keys) |
| `integrations/missive-js/` | Missive JS API bridge |
| `worker/parse-sales-worker.js` | Background parser for the historical sales export |
| `cloudflare-worker/miss-woo-api.js` | Middleman source (deployed by hand in Cloudflare) |
| `wordpress/miss-woo-fast-lookup.php` | Optional one-request lookup add-on for WordPress |
| `__tests__/` | Jest tests (`npm test`) |
| `.github/workflows/main.yml` | CI Pipeline: tests, key check, build, publish to GitHub Pages |

## Safety rules

- **Never commit keys, secrets or the pass.** They live only in Cloudflare (Worker → Settings → Variables and Secrets). The CI Pipeline blocks publishing anything that looks like a key.
- **This repo is public.** Never commit real customer names, emails, addresses or order details. Use `example.com` in tests.
- The middleman's WooCommerce key must stay **Read-only**.
- Make changes on a branch with a pull request. Don't push straight to `main`.

## More

See [SETUP-AND-DEPLOYMENT.md](SETUP-AND-DEPLOYMENT.md) for setup, deploying, health checks and rotating keys.
