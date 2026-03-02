# Implementation Roadmap — You and I Doing the Coding

**Project:** UMS  
**Last updated:** 2026-02-27

This is the coding plan so we build the solution together. **Full vision checklist:** see [full-vision-roadmap.md](full-vision-roadmap.md).

---

## Where we are

| Done | Not yet |
|------|---------|
| Architecture, schema, Option A, multi-tenant, pricing | **Lightspeed** API integration in middleware |
| Static vehicle list + vehicle API | Find-or-create **in Lightspeed** + add to Lightspeed cart |
| **Ecwid** add-from-diagram (find-or-create, pre-filled cart URL) | Storefront: Lightspeed theme or headless calling our API |
| **ARI** redirect endpoint (`/api/ari-add-to-cart`) + bridge script | Vehicle funnel: inventory iframe, lead gen, credit app |
| Config per site, tenant resolution | Fitment on products, SEO / AI readiness |
| CORS, ARI param mapping, docs | Production deploy, multi-tenant at scale |

---

## Next coding steps (in order)

### 1. Lightspeed API credentials (you)

- In your Lightspeed eCom admin, create or locate **API credentials** (API key + secret).  
- Docs: [Lightspeed eCom API – Authentication](https://developers.lightspeedhq.com/ecom/introduction/authentication/).  
- US base URL is typically `https://api.shoplightspeed.com/` (or your store’s cluster).  
- Put in `middleware/.env`: `LIGHTSPEED_ACCOUNT_ID`, `LIGHTSPEED_API_KEY`, `LIGHTSPEED_API_SECRET`, and store URL if needed.

### 2. Lightspeed client in middleware (we code)

- Add a small **Lightspeed API client** in the middleware (e.g. `middleware/src/lib/lightspeed.js`):
  - **List/search products** — e.g. by custom attribute or title containing OEM part number (Lightspeed eCom may use metafields or custom fields; we’ll confirm from their API).
  - **Create product** — when not found: title, description, variants (price), and custom data for `oem_part_number`, `fitment_scope`, `vehicle_fitment`, `oem_manufacturer` (per [vehicle-fitment-schema](vehicle-fitment-schema.md)).
- Use tenant’s Lightspeed credentials when `req.tenant` is set; otherwise use env.

### 3. Add-from-diagram → find-or-create → add to cart (we code)

- In `middleware/src/routes/add-to-cart.js`:
  1. Accept payload: `oemPartNumber`, `description`, `price`, `manufacturer`, `vehicleSlug`, `quantity`.
  2. **Find** product in Lightspeed (by OEM part number / custom field).  
  3. **If not found:** create product + variant with fitment fields and OEM fields.  
  4. **Add to cart:** Lightspeed eCom has a **Checkout API** (create checkout, add line items). We’ll either:
     - Create a checkout with the variant and redirect the user to the checkout URL, or  
     - If we find a simpler “add to cart” link (e.g. storefront URL with variant id), redirect there.  
  5. Return `{ cartUrl }` (or checkout URL) for the storefront to redirect the customer.

### 4. ARI Partstream (when available)

- When you have ARI embed or API details: we’ll define the exact payload (part number, price, vehicle context) and map it into our `add-from-diagram` payload. No change to the flow above; we just adapt the request body or add a thin ARI-specific route that forwards to the same logic.

### 5. Storefront (theme or headless)

- Once add-from-diagram works (postman → middleware → Lightspeed), we connect the storefront: ARI “Add to cart” calls our `POST /api/add-from-diagram`, we return the redirect URL, and the storefront sends the customer to the cart/checkout.

---

## What to do right now

1. **You:** Get Lightspeed API key + secret (and account/cluster info) from your Lightspeed eCom admin and add them to `middleware/.env` (see `.env.example`).  
2. **Us:** Implement the Lightspeed client (product search by OEM number, product create with fitment) and wire `add-to-cart.js` to it (find-or-create → add to checkout/cart → return URL).

After that we can test end-to-end with your site and then plug in ARI and the storefront.

You’re not getting ahead — this is exactly where we planned to go. Next concrete step: you add credentials; I’ll add the Lightspeed client and the find-or-create + add-to-cart flow in the middleware.
