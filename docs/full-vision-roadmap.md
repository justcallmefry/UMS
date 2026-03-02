# Full vision roadmap — UMS Powersports platform

**Project:** UMS — dual-path storefront (Parts + Vehicles), ARI Partstream, fitment, multi-tenant  
**Last updated:** 2026-02-27

This roadmap tracks the full product vision and what’s done vs. remaining. We execute in phases; each phase has clear deliverables.

---

## Vision summary (from synopsis)

- **Powersports eCommerce** on Lightspeed eCom (and currently Ecwid as pilot).
- **Dual path:** (1) **Shop Parts** — catalog + OEM parts from ARI Partstream diagrams, unified cart; (2) **Shop Vehicles** — inventory, lead gen, credit app, no cart.
- **Vehicle fitment** — Type / Year / Make / Model; products tagged as universal, type-specific, or vehicle-specific.
- **Multi-tenant** — one middleware serving many client stores (sites).
- **SEO & AI readiness** — schema, structured data, FAQ modules.

---

## Current status (done)

| Area | Status | Notes |
|------|--------|-------|
| **Middleware API** | ✅ Done | Health, vehicle list, types, by-slug; CORS, urlencoded for ARI form POST. |
| **Add-from-diagram (Ecwid)** | ✅ Done | Find-or-create product, pre-filled cart URL, POST + ARI redirect endpoint. |
| **ARI Partstream integration** | ✅ Done | `/api/ari-add-to-cart` (GET/POST), bridge script, ARI param mapping, docs. |
| **Vehicle list (Option A)** | ✅ Done | Static JSON, per-tenant paths, multi-tenant resolution. |
| **Multi-tenant config** | ✅ Done | `sites.json`, `X-Site-Id`, tenant resolution; Ecwid single-tenant in use. |
| **Docs** | ✅ Done | Architecture, vehicle fitment schema, ARI integration, productization, stack decision. |
| **Local testing** | ✅ Done | `ari-mock.html`, mock page for add-from-diagram. |
| **Lightspeed API client** | ✅ Done | `middleware/src/lib/lightspeed.js`: auth, find variant by SKU, create product + variant. |
| **Add-from-diagram (Lightspeed)** | ✅ Done | When `LIGHTSPEED_API_KEY` (or tenant.lightspeed) is set, find-or-create in Lightspeed; redirect to product page (no pre-filled cart API). |
| **Platform selection** | ✅ Done | Per-tenant or env: use Ecwid **or** Lightspeed; ARI redirect and POST add-from-diagram use same flow. |

---

## Phase 1 — Lightspeed eCom (full vision: “use inside Lightspeed”)

**Goal:** Same add-from-diagram and vehicle flows work with **Lightspeed eCom** as the store backend (so the app is a true “Lightspeed app” option).

| # | Task | Owner | Notes |
|---|------|--------|-------|
| 1.1 | Lightspeed API credentials | You | Add to `.env`: `LIGHTSPEED_API_KEY`, `LIGHTSPEED_API_SECRET`, `LIGHTSPEED_APP_URL` (store front URL). Optional: `LIGHTSPEED_CLUSTER=us`, `LIGHTSPEED_LANGUAGE=en`. |
| ~~1.2~~ | ~~Lightspeed API client~~ | ✅ Done | `middleware/src/lib/lightspeed.js` — find variant by SKU, create product + variant. |
| ~~1.3~~ | ~~Add-from-diagram for Lightspeed~~ | ✅ Done | Find-or-create product+variant; redirect to product page (customer adds to cart there). |
| ~~1.4~~ | ~~Tenant / platform selection~~ | ✅ Done | `useLightspeed(tenant)` — Ecwid vs Lightspeed by tenant or env. |
| ~~1.5~~ | ~~ARI redirect + bridge for Lightspeed~~ | ✅ Done | Same `/api/ari-add-to-cart`; backend uses Lightspeed when configured. |

**Deliverable:** Add-from-diagram and ARI Cart URL work with Lightspeed store; one middleware supports both Ecwid and Lightspeed by tenant. **You:** add Lightspeed credentials to test.

---

## Phase 2 — Vehicle funnel (inventory, leads, no cart)

**Goal:** “Shop Vehicles” path: inventory browse, lead capture, credit application entry points.

| # | Task | Owner | Notes |
|---|------|--------|-------|
| ~~2.1~~ | ~~Inventory embed~~ | ✅ Done | Config + API: `vehicleFunnel.inventoryEmbedUrl` and `GET /api/vehicle-funnel`. |
| ~~2.2~~ | ~~Lead capture / CRM~~ | ✅ Done | Optional `POST /api/lead` proxy; config `leadWebhookUrl` or `LEAD_WEBHOOK_URL`. |
| ~~2.3~~ | ~~Credit application entry~~ | ✅ Done | Config + API: `vehicleFunnel.creditAppUrl` / `CREDIT_APP_URL` in funnel response. |
| ~~2.4~~ | ~~Vehicle funnel page (optional)~~ | ✅ Done | Doc + demo: [docs/vehicle-funnel-integration.md](vehicle-funnel-integration.md), `storefront-scripts/vehicle-funnel-demo.html`. |

**Deliverable:** Vehicle path is clearly defined (inventory + leads + credit); storefront or theme can embed and link. **You:** set env or tenant URLs and use the demo or your own page.

---

## Phase 3 — Storefront & “app inside Lightspeed”

**Goal:** Storefront actually uses the middleware and ARI; optional “Lightspeed app” packaging.

| # | Task | Owner | Notes |
|---|------|--------|-------|
| 3.1 | Lightspeed theme integration | Dev / You | Theme loads bridge script; ARI Cart URL or JS callback points at middleware. |
| 3.2 | Vehicle selector / My Garage (optional) | Dev | UI to pick Y/M/M; store selection in session or local storage; filter parts by fitment. |
| 3.3 | Lightspeed App Store listing (optional) | You | If offering as an app: listing, install flow, OAuth or API key setup. |

**Deliverable:** Live storefront (theme or headless) uses middleware + ARI; optional app packaging.

---

## Phase 4 — Fitment, SEO & AI readiness

**Goal:** Products tagged with fitment; SEO and AI-friendly structure.

| # | Task | Owner | Notes |
|---|------|--------|-------|
| 4.1 | Fitment on products | Dev | When creating product from diagram, set Lightspeed/Ecwid custom fields or metafields for vehicle fitment (per vehicle-fitment-schema). |
| 4.2 | Filter by vehicle | Dev | API or storefront: filter products by vehicle (Y/M/M or slug). |
| 4.3 | Schema markup | Dev | Product, Vehicle, Breadcrumb, FAQ schema where applicable. |
| 4.4 | FAQ / content blocks | Dev | Optional FAQ modules or dynamic fitment content (“Fits 2023 Yamaha YZ250F”). |

**Deliverable:** Fitment data on diagram-origin products; basic schema and optional FAQ for SEO/AI.

---

## Phase 5 — Production & multi-tenant at scale

**Goal:** Deploy for production; onboard multiple sites cleanly.

| # | Task | Owner | Notes |
|---|------|--------|-------|
| 5.1 | Deploy middleware | Dev / You | Hosting (e.g. Railway, Render, Fly.io, VPS); env and secrets; public URL for ARI and storefront. |
| 5.2 | PartStream Cart URL (production) | You | Set Cart URL to `https://your-middleware.com/api/ari-add-to-cart` (and `?siteId=…` if multi-tenant). |
| 5.3 | Add second (and more) sites | Dev / You | Add entries to `sites.json`; store credentials; give each site its `siteId` for Cart URL or header. |
| 5.4 | Monitoring / logging | Dev | Optional: health checks, error logging, rate limits. |

**Deliverable:** Middleware live in production; multiple sites configured and using ARI + add-from-diagram.

---

## Rough completion (full vision)

| Phase | Description | Est. % of full vision |
|-------|-------------|------------------------|
| **Done** | Ecwid + ARI + vehicle API + multi-tenant config | ~35–40% |
| **Phase 1** | Lightspeed eCom | +20–25% |
| **Phase 2** | Vehicle funnel (inventory, leads, credit) | +10–15% |
| **Phase 3** | Storefront & “app inside Lightspeed” | +15–20% |
| **Phase 4** | Fitment, SEO, AI | +5–10% |
| **Phase 5** | Production & multi-tenant at scale | +5–10% |

**Next recommended step:** Phase 1 — add Lightspeed API client and wire add-from-diagram (and ARI) to Lightspeed so the same app works “inside Lightspeed” as well as on Ecwid.

---

*This doc is the single checklist for the full vision. Implementation details live in [implementation-roadmap.md](implementation-roadmap.md), [technical-architecture.md](technical-architecture.md), and [ari-partstream-integration.md](ari-partstream-integration.md).*
