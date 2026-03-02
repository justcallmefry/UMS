# Vehicle funnel integration — inventory, leads, credit app

The **Shop Vehicles** path is lead-gen only: no cart. Customers browse inventory (e.g. iframe), submit leads, and follow CTAs to credit application or contact.

## API

### GET /api/vehicle-funnel

Returns URLs for the current tenant (or env defaults) so the storefront can:

- Embed vehicle inventory (iframe `src`)
- Post lead form data (to your CRM via optional middleware proxy)
- Link to credit application

**Example response:**

```json
{
  "ok": true,
  "vehicleFunnel": {
    "inventoryEmbedUrl": "https://inventory.example.com/embed",
    "leadWebhookUrl": "https://your-crm.com/webhooks/lead",
    "creditAppUrl": "https://credit-provider.com/apply?partner=yourstore"
  }
}
```

Any null value means “not configured”; hide that CTA or use a fallback.

**Multi-tenant:** Send `X-Site-Id: acme-powersports` or `?siteId=acme-powersports` to get that site’s vehicle funnel config.

---

### POST /api/lead (optional proxy)

If you set `LEAD_WEBHOOK_URL` (or `tenant.vehicleFunnel.leadWebhookUrl`), the middleware can forward lead submissions to your CRM.

**Request:** `POST /api/lead` with JSON body, e.g.:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "555-123-4567",
  "message": "Interested in 2023 Yamaha YZ250F",
  "source": "vehicle-funnel"
}
```

**Behavior:** Middleware forwards the body to your webhook URL. If the webhook is not configured, returns `501 Not Implemented`.

---

## How to find these URLs

- **Inventory embed URL** — If you use **Dealer Spike**, **vAuto**, or another inventory/listing provider, log into their dealer dashboard and look for “Embed”, “Widget”, “Add to website”, or “Inventory feed”. They’ll give you a URL (often with your dealer ID in it). That URL is what you put in `VEHICLE_INVENTORY_EMBED_URL`. If you’re not sure, ask your inventory provider: “What’s the embed or iframe URL for our vehicle listings?”
- **Lead webhook URL** — This is the endpoint that should receive lead form data (name, email, phone, message). Examples: a **Zapier** “Webhooks by Zapier” catch URL, a **HubSpot** or other CRM form endpoint, or your own backend. You only need this if you want the middleware to proxy leads via `POST /api/lead`; otherwise your storefront can post directly to your CRM.
- **Credit app URL** — The full link to your credit/financing application (e.g. `https://apply.yourbank.com/...` or your financing partner’s application page). Check with whoever handles your powersports financing for the exact URL.

---

## Proceeding without URLs

You don’t need any of these URLs to start. The API and demo page work as-is:

- **API:** `GET /api/vehicle-funnel` returns `vehicleFunnel` with nulls for anything not set.
- **Demo:** `storefront-scripts/vehicle-funnel-demo.html` shows “No … configured” for missing values and only shows the inventory iframe and credit button when URLs are present.

**What you can do now:**

1. Run the middleware and open the demo page to confirm the funnel layout and “not configured” messaging.
2. Build or style your real storefront page; have it call `/api/vehicle-funnel` and show/hide sections based on whether each URL is set (same pattern as the demo).
3. When you get each URL, add it and the corresponding section will start working with no code change.

**When you get each URL — where to put it:**

| You get | Ask for | Put it in (single site) | Put it in (multi-tenant) |
|--------|---------|--------------------------|---------------------------|
| Inventory embed | “Embed or iframe URL for our vehicle listings” from inventory provider (Dealer Spike, vAuto, etc.) | `middleware/.env` → `VEHICLE_INVENTORY_EMBED_URL` | `config/sites.json` → `sites[].vehicleFunnel.inventoryEmbedUrl` |
| Lead webhook | Webhook or form endpoint from CRM (Zapier, HubSpot, etc.) | `middleware/.env` → `LEAD_WEBHOOK_URL` | `config/sites.json` → `sites[].vehicleFunnel.leadWebhookUrl` |
| Credit app link | “Apply for financing” URL from financing partner | `middleware/.env` → `CREDIT_APP_URL` | `config/sites.json` → `sites[].vehicleFunnel.creditAppUrl` |

**Demo mode — show off without real URLs:** The repo includes built-in placeholder pages so you can run the full funnel with dummy data. In `middleware/.env` the vehicle funnel variables are set to:

- **Inventory:** `http://localhost:3001/demo/inventory-placeholder` — a fake list of vehicles (iframe).
- **Lead webhook:** `http://localhost:3001/demo/lead-echo` — accepts POSTs and logs to the server console (no external CRM).
- **Credit app:** `http://localhost:3001/demo/credit-placeholder` — a simple “Apply for financing” placeholder page.

Start the middleware and open `storefront-scripts/vehicle-funnel-demo.html` to see the inventory iframe, “Apply for financing” link, and (if the demo page includes a lead form) lead submit in action. When you have real URLs, replace these in `.env` or `sites.json`.

---

## Config

### Env (.env)

| Variable | Description |
|----------|-------------|
| `VEHICLE_INVENTORY_EMBED_URL` | Full URL for inventory iframe (e.g. Dealer Spike embed). |
| `LEAD_WEBHOOK_URL` | URL to POST lead payload (your CRM or form backend). |
| `CREDIT_APP_URL` | Link for “Apply for financing” / credit application. |

### Per-tenant (sites.json)

Under each site, add `vehicleFunnel`:

```json
"vehicleFunnel": {
  "inventoryEmbedUrl": "https://inventory.dealer.com/embed",
  "leadWebhookUrl": "https://crm.example.com/leads",
  "creditAppUrl": "https://credit.example.com/apply?partner=mystore"
}
```

Env vars like `${LEAD_WEBHOOK_URL}` are resolved by the tenant loader.

---

## Storefront usage

1. **Inventory:** Call `GET /api/vehicle-funnel`, then set your iframe `src` to `vehicleFunnel.inventoryEmbedUrl` (if non-null).
2. **Lead form:** Either post directly to your CRM, or post to `POST /api/lead` with the same payload; middleware forwards to `leadWebhookUrl` when set.
3. **Credit app:** Use `vehicleFunnel.creditAppUrl` as the href for “Apply for financing” (or similar).

No cart or product API is used on the vehicle path.

---

## Adding the Shop Vehicles page to your live site

A production-ready **Shop Vehicles** page is in `storefront-scripts/shop-vehicles.html`. It uses the same API as the demo but with customer-facing copy and no “not configured” or debug text.

**Sites like United Motorsports (Company Site / Ecwid by Lightspeed)** don’t let you upload raw HTML as a new page. Use one of the options below, then add a link (e.g. “Shop Vehicles”) in your site’s navigation to that URL.

### 1. Host the page

- **Option A — From your middleware (simplest once API is deployed):** The middleware serves the page at `GET /shop-vehicles`. Deploy the middleware (e.g. to Railway, Render, or a VPS) and open `https://your-middleware-url.com/shop-vehicles`. The page automatically uses that same host for the API, so no extra config. Then on your Company Site, add a nav link: “Shop Vehicles” → `https://your-middleware-url.com/shop-vehicles`.
- **Option B — Static host (Netlify, GitHub Pages, etc.):** Upload `shop-vehicles.html` (or the whole repo) to Netlify Drop, GitHub Pages, or similar. You’ll get a URL like `https://something.netlify.app/shop-vehicles.html`. Set `window.UMS_VEHICLE_FUNNEL_API_BASE = 'https://your-middleware-url.com'` (in the file or via your host’s “Inject head” / custom code). On your Company Site, add a nav link to that URL.
- **Option C — Iframe:** If your platform only allows embedding, add a page with a full-width iframe whose `src` is the Shop Vehicles URL (from Option A or B).

### 2. Point the page at your middleware (only for Option B)

If you hosted the page on a **static host** (Option B), it must know your middleware URL. After you deploy the middleware (see [docs/full-vision-roadmap.md](full-vision-roadmap.md)):

- Set `window.UMS_VEHICLE_FUNNEL_API_BASE = 'https://your-middleware.example.com';` before the page loads (e.g. in your host’s “Inject head” or custom code), or edit the variable at the top of the script in `shop-vehicles.html`.

If you used **Option A** (page served from the middleware at `/shop-vehicles`), the page uses the same origin automatically — no config.

### 3. Multi-tenant (optional)

If one middleware serves multiple sites, set the site so the correct inventory/lead/credit URLs are used:

- **Global for the page:**  
  `window.UMS_VEHICLE_FUNNEL_SITE_ID = 'acme-powersports';`
- **Or by URL:**  
  Link to the page with a query param: `https://yoursite.com/shop-vehicles?siteId=acme-powersports`

The page sends `X-Site-Id` (or `?siteId=`) on `GET /api/vehicle-funnel` and `POST /api/lead`.

### 4. Link from your site

Add a nav or menu link (e.g. “Shop Vehicles” or “Inventory”) to the URL where you hosted the page.

### 5. Debug

To show the raw API response at the bottom of the page (e.g. to confirm config), open the page with `?debug=1`:  
`https://yoursite.com/shop-vehicles?debug=1`
