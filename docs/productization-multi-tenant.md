# Productization & Multi-Tenant Design — UMS for Many Sites

**Project:** UMS — Powersports Online Store  
**Last updated:** 2025-02-26

This document describes how to turn the UMS solution into a **reusable product** you can sell and implement for many Lightspeed-powered powersports dealers. One codebase, many client sites; each site has its own config and (optionally) its own vehicle data.

---

## 1. Goal

- **Build once, deploy for many clients** — Same middleware, same architecture, config-driven per site.
- **Sell and implement** — Clear offering (e.g. “ARI Partstream + fitment on your Lightspeed store”), pricing model, and implementation checklist.
- **Operate efficiently** — Host one middleware service (or let clients self-host); onboard new sites without forking the repo.

---

## 2. What You’re Selling (The Offering)

Package the work into a **productized service** that you can name and price:

| Component | What the client gets |
|-----------|------------------------|
| **ARI Partstream integration** | OEM parts diagrams on their site; “add to cart” flows into their Lightspeed cart. |
| **Vehicle fitment (Option A)** | Vehicle selector, fitment filtering, and (optional) My Garage; consistent with your schema. |
| **Unified cart** | Parts from catalog and from diagrams all in one Lightspeed checkout. |
| **Implementation** | You configure their site (or theme), connect their Lightspeed + ARI, load their vehicle list, and go live. |

**Optional add-ons:** SEO/fitment content, vehicle funnel (inventory iframe + lead gen), custom vehicle list build-out, training.

You can sell this as:
- **One-time implementation + annual support/subscription**, or  
- **Subscription SaaS** (you host the middleware and charge per site/month), or  
- **License + implementation** (they or you host the middleware; they pay for the solution and setup).

---

## 3. Pricing & Packaging — Locked-In Plan

**Model: one-time implementation + monthly platform fee.**

### Standard package (current offering)

| | Price |
|--|--------|
| **Implementation** | **$4,000** (one-time) |
| **Platform** | **$149/month** |

**Implementation includes:** Discovery, Lightspeed + ARI connection, vehicle list (shared list or mapping), theme/integration for add-from-diagram and vehicle selector, testing, go-live, and handoff.

**Monthly includes:** Hosted middleware, monitoring, security/updates, and email support.

**Out of scope for standard (quote separately):** Custom vehicle list build-out from scratch, multiple OEMs beyond 1–2, heavy theme redesign, dedicated training, SEO/fitment content, vehicle funnel (inventory iframe + lead gen).

---

### Pilot & adjust

1. **Run 2–3 pilots** at this price ($4,000 + $149/mo). Deliver using the implementation playbook; track actual hours and any scope creep.
2. **After pilots, review:**
   - **Close rate** — Are prospects saying yes at this price, or do we need to sharpen the pitch or adjust the number?
   - **Delivery cost** — Did implementation stay within margin? If not, raise implementation, trim scope, or add a “Premium” tier with a higher one-time.
   - **Churn** — Do clients stay on monthly? If not, improve onboarding, support, or perceived value (e.g. vehicle list updates, light reporting).
3. **Adjust** — Update implementation and/or monthly price, or add a second tier (e.g. Premium: $6,000 + $249/mo with custom list and priority support). Document the new structure in this section.

No change to the product or repo required; this is a pricing and process decision.

---

## 4. Multi-Tenant Model: One Codebase, Many Sites

**Tenant = one client store.** Each tenant has:

- **Lightspeed:** their own account (API key, account ID, store URL).
- **ARI:** their Partstream relationship (credentials or embed config if ARI is per-dealer).
- **Vehicle data:** their own list (or a shared industry list you maintain and they subset).
- **Branding/URLs:** their storefront URL, cart URL, and any white-label needs.

**Ways to run “many sites”:**

| Model | How it works | Best for |
|-------|-----------------------------|----------|
| **Single hosted middleware, config per tenant** | One deployment (your SaaS). Each request identifies the site (e.g. by domain or `siteId`); middleware loads that site’s config and talks to that client’s Lightspeed (and ARI if server-side). | You host and charge per site/month; clients only point their storefront at your API. |
| **Config file / DB per tenant** | Same codebase; `sites.json` or a `sites` table holds `siteId` → Lightspeed credentials, ARI config, vehicle list path. Middleware resolves tenant from `X-Site-Id` header or from the request domain. | Clean separation; easy to add sites without code changes. |
| **Deploy per client (single-tenant)** | Each client gets their own deployment (e.g. Vercel/Railway) with env vars for that one site. Same repo, different `.env` or config. | Clients who want isolation or self-hosting; you still “productize” the repo and implementation playbook. |

**Recommendation:** Start with **single hosted middleware + config per tenant** (sites file or DB). That gives you one app to maintain and a clear path to add clients. Optionally support **deploy-per-client** for shops that require it (same code, different config per deploy).

---

## 5. Config Per Site (Tenant Config)

Each site needs at least:

```json
{
  "siteId": "acme-powersports",
  "name": "Acme Powersports",
  "lightspeed": {
    "accountId": "...",
    "apiKey": "...",
    "apiSecret": "...",
    "storeUrl": "https://acme-powersports.com"
  },
  "ari": {
    "enabled": true,
    "embedConfig": { }
  },
  "vehicles": {
    "source": "file",
    "path": "data/sites/acme-powersports/vehicles.json"
  },
  "cartRedirectBase": "https://acme-powersports.com/cart"
}
```

- **siteId** — Unique key; used in URLs or headers so the middleware knows which tenant to use.
- **lightspeed** — That store’s API credentials and store URL.
- **ari** — Whether ARI is enabled and any embed or server-side config.
- **vehicles** — “file” + path to their vehicle list (or “shared” + shared list id); keeps Option A but per site or shared.
- **cartRedirectBase** — Where to send the customer after add-from-diagram (their cart URL).

Sensitive values (apiKey, apiSecret) should live in env or a secrets store, keyed by `siteId`, not in the repo. The config file or DB can reference “use env LIGHTSPEED_ACME_API_KEY.”

---

## 6. How the Storefront Identifies the Tenant

Your middleware must know **which site** each request belongs to.

- **Option A — Header:** Storefront (theme or headless) sends `X-Site-Id: acme-powersports` (or similar) on every request to your API. You give each client a site id when you onboard them.
- **Option B — Domain:** Middleware maps `Host: shop.acmepowersports.com` to a site (e.g. via a domains table or config). Works well if each client has a distinct subdomain or domain pointing at your service.
- **Option C — API key per site:** Each client gets an API key; middleware looks up site by key. Same idea as header but key-based.

For a **hosted SaaS**, **header or API key** is simplest: you give the client (or their developer) a site id and optional API key; they add it to their theme or headless app when calling your add-from-diagram and vehicle APIs.

---

## 7. Vehicle Data: Per-Site vs Shared

- **Per-site:** Each client has their own `vehicles.json` (or equivalent) — e.g. in `data/sites/<siteId>/vehicles.json`. You or they maintain it; you can offer “vehicle list build-out” as part of implementation.
- **Shared:** One or more industry lists (e.g. “dirtbike-2020-2024”, “utv-polaris”) that many sites use; config points to a shared list id. Reduces duplication; you maintain the list once.

You can support both: config has `vehicles.source: "file"` and `vehicles.path` for per-site, or `vehicles.source: "shared"` and `vehicles.listId` for a shared list. Middleware loads the right list based on config.

---

## 8. Packaging for Sale and Implementability

**Product name and tiers (example):**

- **“UMS Parts + Fitment”** or **“Powersports Fitment for Lightspeed”** — Base: ARI add-to-cart + vehicle list API + Option A fitment on Lightspeed.
- **Tiers:** Standard (shared vehicle list, you host middleware) | Premium (custom vehicle list, dedicated support) | Enterprise (on-prem or deploy-per-client, SLA).

**Implementation playbook (repeatable for each new site):**

1. **Sales/onboarding** — Contract, collect store URL, Lightspeed admin access (or API keys), ARI relationship (or use your ARI partner account if applicable).
2. **Create tenant** — Add site to your config/sites DB; create `siteId`; store Lightspeed (and ARI) credentials in env/secrets.
3. **Vehicle data** — Use shared list or create `data/sites/<siteId>/vehicles.json` (and types if needed).
4. **Theme/integration** — Either you or their dev: add ARI embed, vehicle selector, and “add to cart” calls to your middleware (with their `siteId`/API key). Point cart redirect to their Lightspeed cart.
5. **Test** — Add from diagram → product in Lightspeed → cart; vehicle filter and selector.
6. **Go live** — Switch to production credentials, document their URLs and keys for their team.

This playbook becomes a **checklist** (in Notion, Airtable, or a simple markdown file in the repo) so every implementation is consistent.

---

## 9. Repo and Code Changes for Multi-Tenant

- **Config layer** — Add a small module that loads tenant config by `siteId` (from header, domain, or API key). Middleware uses it in every request that needs Lightspeed or vehicle data.
- **Sites directory** — e.g. `data/sites/<siteId>/vehicles.json` and optionally `config.json` (non-secret only; secrets in env).
- **Default/fallback** — If you still support a single-tenant mode (one set of env vars, no site id), keep a default tenant so existing single-site use still works.

Next concrete steps in code:
- Add `config/sites.example.json` and a `getSiteConfig(siteId)` (or resolve from request).
- Mount vehicle routes and add-from-diagram behind tenant resolution; use tenant’s Lightspeed and vehicle path.
- Document in README how to add a new site (config + vehicles + playbook link).

---

## 10. Summary

| Question | Answer |
|----------|--------|
| Use for many sites? | Yes — one codebase; **tenant = one client site** with its own config (Lightspeed, ARI, vehicles, cart URL). |
| Sell it? | Yes — package as **productized offering** (ARI + fitment + unified cart); price as implementation + subscription or license. |
| Implement repeatedly? | Yes — **implementation playbook** (tenant creation, vehicle data, theme integration, test, go-live); optional checklist in repo. |
| Hosting | Prefer **single hosted middleware** with config per tenant; support **deploy-per-client** for clients who need it. |

If you want, the next step is to add the **tenant config schema**, **sites example**, and **tenant resolution** in the middleware so the same codebase is ready for many sites and you can sell and implement it cleanly.
