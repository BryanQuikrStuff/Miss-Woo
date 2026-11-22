# Setup and deployment

## 1. Sidebar (GitHub Pages)

- Published automatically from `main` by the **CI Pipeline** action (`.github/workflows/main.yml`).
- To change it: edit on a branch, open a pull request, merge. Check **Actions** for a green run (about 1 minute), then reload the sidebar in Missive.
- The repo needs **no GitHub secrets**.

**Missive integration URL** (Missive → Settings → Integrations):

```
https://quikrstuff.github.io/Miss-Woo/?token=<ACCESS_TOKEN>
```

The pass is stored in the team password manager. Never paste it into GitHub, chat or email.

## 2. Middleman (Cloudflare Worker `miss-woo-api`)

URL: `https://miss-woo-api.bryan-df4.workers.dev`

**Deploy a new version**

1. Merge the change to `cloudflare-worker/miss-woo-api.js` on GitHub.
2. In Cloudflare, open **Workers & Pages → miss-woo-api → Edit code**.
3. Replace all the code with the new file and click **Deploy**.
4. Open `/health` and check the version and that every secret shows `true`.

**Settings** (Worker → Settings → Variables and Secrets)

| Name | Type | What it is |
|---|---|---|
| `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | Secret | WooCommerce REST key, **Read** permission only |
| `KATANA_API_KEY` | Secret | Katana API key |
| `ACCESS_TOKEN` | Secret | The pass the sidebar sends |
| `ALLOWED_ORIGINS` | Text | `https://quikrstuff.github.io` (the site allowed to call the middleman) |
| `ORDER_STATUSES` | Text, optional | Default `processing,completed,pending` |

Cloudflare may show a notice about updating a Wrangler configuration. This project doesn't use Wrangler, so you can ignore it.

**Routes**

| Route | What it does |
|---|---|
| `GET /health` | No pass needed. Shows the version and which secrets are set. |
| `GET /api/ping` | Checks the WooCommerce and Katana keys work. |
| `GET /api/orders/by-email?email=a,b` | Recent orders (with notes) for up to 4 customer emails. |
| `GET /api/orders/search?q=&page=` | Name / free-text search (slow). |
| `GET /api/orders/:id` | One order, with notes. |
| `GET /api/orders/:id/notes` | An order's notes. |
| `GET /api/katana/order?order_no=` | Katana sales order and serial numbers for a Woo order number. |

Results are cached for 5 minutes (Katana: 15). The Worker logs timings only (routes, durations, statuses), never customer details.

## 3. Fast lookup add-on (optional, WordPress)

`wordpress/miss-woo-fast-lookup.php` is a read-only must-use plugin. It lets the middleman get a customer's orders and notes in one request instead of three or more. The web developer uploads it to `wp-content/mu-plugins/` on quikrstuff.com. The middleman finds it automatically and falls back to the normal lookup if it's missing. When it's working, the Worker logs show `source: fast`.

## 4. Rotating keys

1. Create the new key (WooCommerce: **Read** permission only; or Katana; or a new long random pass).
2. Paste it into Cloudflare → Worker → Settings → Variables and Secrets (edit the existing secret) and deploy.
3. Check `/health`, then click a customer conversation in Missive.
4. Revoke the old key in WooCommerce or Katana.
5. If you changed the `ACCESS_TOKEN`, update the Missive integration URL and the password manager.

## 5. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sidebar says "Missing access pass" | The Missive integration URL is missing `?token=…` |
| Sidebar loads but no orders, browser shows a CORS error | `ALLOWED_ORIGINS` in Cloudflare doesn't match the sidebar's address |
| `/health` shows a secret as `false` | That secret is missing in Cloudflare |
| Lookups slow (2–7 s) | Normal without the fast lookup add-on; WooCommerce itself is the bottleneck |
