# Stack Decision — Storefront & Middleware

**Project:** UMS — Powersports Online Store  
**Related:** [Technical Architecture](technical-architecture.md)  
**Last updated:** 2025-02-26

This document compares two approaches for the storefront and glue layer, and records the chosen stack (or decision criteria) so the team can implement consistently.

---

## Options

| | Option 1: Lightspeed theme + middleware | Option 2: Headless + middleware |
|--|----------------------------------------|----------------------------------|
| **Storefront** | Lightspeed-hosted eCom site + theme customization | Custom front end (e.g. Next.js, React) that calls Lightspeed API |
| **Middleware** | Standalone service (Node/Express or serverless) that handles add-from-diagram, vehicle list API, etc. | Same idea; can be same codebase or merged into headless app (e.g. Next.js API routes) |
| **ARI Partstream** | Embedded in Lightspeed theme pages; "Add to cart" posts to our middleware, which talks to Lightspeed | Embedded in headless pages; same flow |
| **Vehicle list / fitment** | Served by middleware API; theme fetches for selector and filtering | Served by middleware or by headless API routes; same data |

---

## Option 1: Lightspeed theme + middleware

**How it works:** You run a Lightspeed eCom store and customize the theme. A separate middleware app (Node/Express or serverless) exposes endpoints for "add from diagram" and optionally vehicle list. The theme embeds ARI and, when the user adds a part, calls the middleware; middleware creates product in Lightspeed (if needed) and adds to cart, then redirects to the Lightspeed cart URL.

**Pros**

- Fastest path to a live store: Lightspeed handles hosting, checkout, accounts, and SEO-friendly product/category pages.
- Less custom front-end code: no need to build product listing, cart UI, or checkout.
- Theme customization (Liquid, etc.) is well documented; many dealers already know Lightspeed.

**Cons**

- Theme and middleware are two surfaces to deploy and maintain.
- Deep customization (e.g. vehicle-first navigation, heavy personalization) can be harder inside theme constraints.
- You depend on Lightspeed’s URL and page structure for parts funnel.

---

## Option 2: Headless + middleware

**How it works:** A custom front end (e.g. Next.js) renders the entire site, fetches products and cart from Lightspeed API, and embeds ARI. "Add from diagram" can go to the same backend (middleware or Next API routes), which creates the product in Lightspeed and adds to cart; user is sent to the Lightspeed cart or a headless cart that syncs with Lightspeed.

**Pros**

- Full control over UX, URLs, and information architecture (e.g. vehicle-centric navigation, My Garage).
- One codebase can host both marketing site and parts funnel with consistent design and performance.
- Easier to add other data sources or APIs later without touching Lightspeed theme.

**Cons**

- More to build: product listing, cart, checkout (or checkout redirect to Lightspeed), and possibly auth/session handling.
- Higher initial effort and ongoing front-end maintenance.
- SEO and performance are your responsibility (though Next.js and good structure mitigate this).

---

## Recommendation

- **If the goal is to go live quickly and validate ARI + fitment + cart flow:** choose **Option 1** (Lightspeed theme + middleware). Implement the middleware first (add-from-diagram, vehicle list), then wire the theme to it.
- **If the goal is a highly custom, vehicle-first experience from day one and you have front-end capacity:** choose **Option 2** (headless + middleware or Next.js API routes). Reuse the same middleware logic for Lightspeed product create and add-to-cart.

**Chosen stack (fill in when decided):**

- [ ] **Option 1** — Lightspeed theme + middleware  
- [ ] **Option 2** — Headless (___________) + middleware / API routes  

*Once chosen, update this section and link from [technical-architecture.md](technical-architecture.md).*
