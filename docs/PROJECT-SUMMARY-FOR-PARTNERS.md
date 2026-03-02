# UMS Project Summary — For Partners

**Date:** February 2025  
**Purpose:** Quick overview of what we’ve done and what’s next, so you can get up to speed or share with others.

---

## What We’re Building

A **productized solution** for powersports dealers that:

- Lets customers **shop parts** (catalog + **OEM parts from interactive diagrams** via ARI Partstream) and **shop vehicles** (inventory + lead gen, no cart).
- Uses **one shopping cart** (Lightspeed or Ecwid) for all parts, including parts added from diagrams.
- Supports **vehicle fitment** (Year/Make/Model) so customers can filter parts by their bike/ATV/UTV and save “My Garage.”
- Can be **sold and implemented for many dealer sites** from one codebase (multi-tenant).

---

## What We’ve Done So Far

### 1. Architecture & design (docs only)

- **Technical architecture** — How the storefront, middleware, Lightspeed (or Ecwid), ARI Partstream, and vehicle data fit together. Data flow for “add from diagram” → create product in store → add to cart.
- **Vehicle & fitment schema** — Vehicle types (dirtbike, ATV, UTV, etc.), Year/Make/Model, and how products are tagged (universal, type-specific, or vehicle-specific). We chose **Option A**: vehicle list in static files, fitment stored in the store’s custom fields (no separate vehicle database for now).
- **Stack decision** — Documented two options: “store theme + middleware” vs “headless + middleware.” Decision can be made when we build the storefront.
- **Productization & multi-tenant** — How we sell and implement this for **many sites**: one middleware, config per client (their store credentials, vehicle list, cart URL). Each request identifies the site (e.g. by `X-Site-Id` or `?siteId=`).
- **Pricing** — Locked-in plan: **$4,000 implementation + $149/month** for the standard package. Run 2–3 pilots, then adjust based on close rate, delivery cost, and churn.
- **Implementation roadmap** — Ordered next steps: get store API credentials → build store API client in middleware → implement “add from diagram” (find-or-create product, add to cart, return URL) → connect ARI and storefront.

### 2. Repo and code (scaffold)

- **Docs** — All of the above are in the `docs/` folder (technical-architecture, vehicle-fitment-schema, stack-decision, productization-multi-tenant, implementation-roadmap, store-ids, etc.).
- **Static vehicle data** — `data/vehicle-types.json` and `data/vehicles.json` (and an example per-site folder `data/sites/acme-powersports/`) for Option A fitment.
- **Config** — `config/sites.example.json` shows how we add multiple client sites (credentials via env vars, vehicle file paths per site). Real `config/sites.json` is gitignored.
- **Middleware (Node/Express)** — Small API that:
  - Serves **vehicle list and types** (`GET /api/vehicles`, `/api/vehicles/types`, `/api/vehicles/by-slug/:slug`), with multi-tenant support (different data per site when `X-Site-Id` or `?siteId=` is sent).
  - Exposes **add-from-diagram** (`POST /api/add-from-diagram`) — currently a **stub** that validates the payload and returns a placeholder cart URL. Not yet connected to the store API.
- **Tenant resolution** — Middleware can serve many sites; each request can carry a site id so we use that client’s config (vehicle list, store URL, etc.).
- **Store ID** — Pilot store (United Motorsports) ID **131197020** is recorded in `docs/store-ids.md` and in `middleware/.env.example` as `STORE_ID=131197020`. Platform is likely Ecwid (to be confirmed); API access may require Venture/Business/Unlimited plan.

### 3. What we have *not* done yet

- **No live store API integration** — We don’t yet have API credentials. When we do, we will:
  - Add a store API client (Lightspeed or Ecwid) in the middleware.
  - Implement find-or-create product (by OEM part number) and add-to-cart (or checkout redirect).
- **No ARI Partstream connection** — We’ll plug in ARI once we have the add-from-diagram flow working with the store.
- **No storefront** — Theme or headless app that calls our middleware and embeds ARI will come after the middleware works end-to-end.

---

## How to Run the Middleware (for devs)

```bash
cd middleware
cp .env.example .env
# Add STORE_ID, and later API keys when available.
npm install
npm run dev
```

- Vehicle API: `GET http://localhost:3001/api/vehicles` and `/api/vehicles/types`
- Add-from-diagram (stub): `POST http://localhost:3001/api/add-from-diagram` with JSON body (oemPartNumber, description, price, etc.)

---

## What We Need to Move Forward

1. **API access** — Store API credentials (key/secret and base URL) for the pilot store. Platform is likely Ecwid; if so, the plan may need to be Venture, Business, or Unlimited for API access.
2. **Once we have credentials** — We’ll wire the middleware to the store (find-or-create product, add to cart) and test. Then we’ll connect ARI and the storefront.

---

## One-line summary

We’ve designed and scaffolded a multi-tenant, fitment-aware parts + diagram solution (architecture, schema, pricing, middleware with vehicle API and stub add-from-diagram). We’re **blocked only on store API credentials**; as soon as we have them, we’ll implement the real add-from-diagram flow and then ARI + storefront.
