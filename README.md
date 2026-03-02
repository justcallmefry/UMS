# UMS — Powersports Online Store

Lightspeed eCom powersports store with ARI Partstream OEM diagram integration, vehicle fitment (Option A), and dual-path storefront (Parts vs Vehicles).

## Repo layout

```
UMS/
├── docs/                    # Architecture and decisions
│   ├── technical-architecture.md
│   ├── vehicle-fitment-schema.md
│   ├── stack-decision.md
│   └── productization-multi-tenant.md   # Sell & implement for many sites
├── config/
│   └── sites.example.json  # Multi-tenant: copy to sites.json, one entry per client
├── data/                    # Option A static vehicle data
│   ├── vehicle-types.json   # Default vehicle type codes
│   ├── vehicles.json        # Default vehicle list
│   └── sites/               # Per-site vehicle data (multi-tenant)
│       └── <siteId>/vehicles.json, vehicle-types.json
├── middleware/              # Add-from-diagram + vehicle list API
│   ├── src/
│   │   ├── server.js
│   │   ├── lib/tenant.js    # Resolve site from X-Site-Id or ?siteId=
│   │   └── routes/
│   │       ├── vehicles.js
│   │       └── add-to-cart.js
│   ├── .env.example
│   ├── ari-mock.html        # Local test page simulating ARI → middleware
│   └── package.json
├── storefront-scripts/      # Scripts and pages for storefront
│   ├── ums-ari-bridge.js    # ARI "Add to cart" → middleware → redirect to cart
│   ├── shop-vehicles.html   # Production Shop Vehicles page (inventory + lead + credit)
│   ├── find-my-vehicle.html # Find My Vehicle widget + My Garage (parts funnel)
│   ├── ums-showcase.html   # Investor demo: dual-path (Parts + Vehicle funnel) with polished CSS
│   └── vehicle-funnel-demo.html  # Demo page for vehicle funnel (dev/testing)
└── README.md
```

## Quick start (middleware)

```bash
cd middleware
cp .env.example .env
# Edit .env with Lightspeed (and optional ARI) credentials.
npm install
npm run dev
```

- **Vehicle list:** `GET http://localhost:3001/api/vehicles` and `GET http://localhost:3001/api/vehicles/types`
- **Storefront pages:** `http://localhost:3001/showcase` (investor demo: Find My Vehicle + Shop Vehicles), `http://localhost:3001/find-my-vehicle`, `http://localhost:3001/shop-vehicles`
- **Vehicle funnel:** `GET http://localhost:3001/api/vehicle-funnel` (inventory embed URL, lead webhook, credit app URL); optional `POST http://localhost:3001/api/lead` to forward leads (see [docs/vehicle-funnel-integration.md](docs/vehicle-funnel-integration.md))
- **Add from diagram:** `POST http://localhost:3001/api/add-from-diagram` with body `{ "oemPartNumber", "description", "price", "manufacturer", "vehicleSlug?", "quantity?" }` — uses **Ecwid** by default; if `LIGHTSPEED_API_KEY` (or tenant `lightspeed`) is set, uses **Lightspeed** and redirects to product page.
- **ARI Partstream Cart URL:** `GET` or `POST` `http://localhost:3001/api/ari-add-to-cart?arisku=...&aridescription=...&ariprice=...` → redirects to Ecwid cart or Lightspeed product page (see [docs/ari-partstream-integration.md](docs/ari-partstream-integration.md))

## Multi-tenant (many sites)

One middleware can serve **many client stores**. Each request can send `X-Site-Id: acme-powersports` (or `?siteId=acme-powersports`); the API then uses that site’s config (vehicle list, Lightspeed credentials, cart URL). See [docs/productization-multi-tenant.md](docs/productization-multi-tenant.md).

**Adding a new site:**

1. Copy `config/sites.example.json` to `config/sites.json` (if not already using it).
2. Add a new entry to `sites` with a unique `siteId`, Lightspeed credentials (use env vars like `${LIGHTSPEED_CLIENTNAME_API_KEY}`), and `vehicles.path` / `vehicleTypesPath` pointing to `data/sites/<siteId>/`.
3. Create `data/sites/<siteId>/vehicles.json` and `vehicle-types.json` (see `data/vehicles.json` and `data/vehicle-types.json` for shape).
4. Store the client’s API keys in your env; give the client (or their theme) their `siteId` to send on each request.

## ARI Partstream "Add to cart" integration

To wire ARI Partstream’s "Add to cart" to the middleware and redirect the customer to your Ecwid cart:

1. Add `storefront-scripts/ums-ari-bridge.js` to the pages that embed ARI (set `UMS_ARI_BRIDGE_CONFIG.apiBase` to your middleware URL).
2. When ARI fires "Add to cart", call `window.UMSAddFromDiagram(part)` with part data (oemPartNumber, description, price, etc.).

See **[docs/ari-partstream-integration.md](docs/ari-partstream-integration.md)** for payload shape, config, and how to connect ARI’s callback.

## Next steps

1. **Confirm ARI Partstream** — add-to-cart payload and vehicle context (see [docs/ari-partstream-integration.md](docs/ari-partstream-integration.md)).
2. **Choose stack** — Lightspeed theme + middleware vs headless; see [docs/stack-decision.md](docs/stack-decision.md).
3. **Connect storefront** — theme or headless app loads the bridge script and wires ARI’s callback to `UMSAddFromDiagram`.

**Full vision roadmap:** [docs/full-vision-roadmap.md](docs/full-vision-roadmap.md) — phases for Lightspeed, vehicle funnel, storefront, SEO, and production.

See [docs/technical-architecture.md](docs/technical-architecture.md), [docs/vehicle-fitment-schema.md](docs/vehicle-fitment-schema.md), and [docs/productization-multi-tenant.md](docs/productization-multi-tenant.md) for full design and how to sell/implement for many sites.
