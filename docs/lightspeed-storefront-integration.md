# Implementing UMS on your Lightspeed storefront

Your Lightspeed plan now supports implementing the vehicle funnel and Find My Vehicle on the live site. This guide is your **starting point**.

---

## Before you start

1. **Middleware must be deployed** so the storefront has a URL to call. If it’s not yet:
   - Deploy the `middleware` app to Railway, Render, Fly.io, or your host (see [README](../README.md) and the deploy step we discussed).
   - Note your base URL, e.g. `https://ums-api.yourdomain.com` or `https://your-app.onrender.com`.

2. **You’ll need access to** your Lightspeed store’s **theme/custom code** or **pages** (where you can add links, HTML, or scripts). That’s usually in:
   - **Lightspeed eCom Back Office** → **Design** / **Theme** (or **Customize theme**), or  
   - **Settings** → **Checkout** / **Scripts** / **Custom code**, or  
   - **Content** → **Pages** (to add new pages and navigation).

Exact labels depend on your Lightspeed version; if you don’t see “Custom code” or “Pages,” check the help docs or ask support where to add custom HTML/scripts and new menu links.

---

## Step 1: Add “Shop Vehicles” to the site

**Goal:** Customers can open a page that shows vehicle inventory, lead form, and “Apply for financing.”

**Option A — Link to the page you already built (easiest)**  
- In your theme/navigation, add a menu item (e.g. **Shop Vehicles** or **Inventory**).  
- Set the link to: `https://YOUR-MIDDLEWARE-URL/shop-vehicles`  
- The middleware serves the full Shop Vehicles page; no code in Lightspeed except the link.

**Option B — Embed in a Lightspeed page (URL stays on your domain)**  
- In Lightspeed, create a new page (e.g. “Shop Vehicles”).  
- Add a **single full-width block** that allows HTML/iframe (many themes have “Custom HTML” or “Embed”).  
- Paste something like:  
  `<iframe src="https://YOUR-MIDDLEWARE-URL/shop-vehicles" title="Shop Vehicles" style="width:100%; min-height:600px; border:none;"></iframe>`  
- Add that page to your main navigation.  
- Replace `YOUR-MIDDLEWARE-URL` with your real middleware base URL.

---

## Step 2: Add “Find My Vehicle” (parts funnel)

**Goal:** Customers can select type/year/make/model and save vehicles to “My Garage” for parts shopping.

**Option A — Link**  
- Add a nav or prominent link (e.g. **Find My Vehicle**) to: `https://YOUR-MIDDLEWARE-URL/find-my-vehicle`

**Option B — Embed in the navigation (widget in header)**  
- If your Lightspeed theme lets you add **custom HTML** or an **iframe** in the header/nav area (e.g. “Header widget,” “Custom code,” or a nav slot):
  1. Add a block that allows **HTML** or **iframe**.
  2. Paste this (replace `YOUR-MIDDLEWARE-URL` with your real URL, e.g. `https://ums-qvlh.onrender.com`):

  ```html
  <div class="ums-find-my-vehicle-nav">
    <iframe
      src="https://YOUR-MIDDLEWARE-URL/find-my-vehicle-nav"
      title="Find My Vehicle"
      style="width:100%; min-width:320px; height:52px; border:none; display:block;"
   ></iframe>
  </div>
  ```

  3. The compact widget shows **Type | Year | Make | Model | Find** and a “My Garage” link in one row. When a customer picks a vehicle and clicks Find, it’s added to My Garage (same as the full page). They can open “My Garage” to see saved vehicles or go to the full Find My Vehicle page.

**Option C — Embed as a full page**  
- Create a page (e.g. “Find My Vehicle”) and embed the full experience:  
  `<iframe src="https://YOUR-MIDDLEWARE-URL/find-my-vehicle" title="Find My Vehicle" style="width:100%; min-height:500px; border:none;"></iframe>`

**Option D — Deeper integration (later)**  
- Your theme could load a script that injects the vehicle selector into a sidebar or header and uses your middleware API (`/api/vehicles/types`, `/api/vehicles`) so the selector looks native. That’s a next phase once the link/iframe flow is live.

---

## Step 3: Set your real config (when you have it)

On the **middleware** (your deployed app), set real URLs in its config (e.g. `.env` or `config/sites.json`):

- **VEHICLE_INVENTORY_EMBED_URL** — Your inventory provider’s embed URL (e.g. Dealer Spike).  
- **LEAD_WEBHOOK_URL** — Your CRM or form endpoint for leads.  
- **CREDIT_APP_URL** — Your financing partner’s application URL.

See [vehicle-funnel-integration.md](vehicle-funnel-integration.md) for details. Until then, the demo placeholders keep the pages working.

---

## Quick reference

| What you want           | URL to use (replace `YOUR-MIDDLEWARE-URL`)     |
|-------------------------|-------------------------------------------------|
| Shop Vehicles page      | `https://YOUR-MIDDLEWARE-URL/shop-vehicles`     |
| Find My Vehicle page    | `https://YOUR-MIDDLEWARE-URL/find-my-vehicle`   |
| Find My Vehicle (nav widget, for iframe in header) | `https://YOUR-MIDDLEWARE-URL/find-my-vehicle-nav` |
| Investor/demo showcase  | `https://YOUR-MIDDLEWARE-URL/showcase`          |
| Vehicle funnel API      | `GET https://YOUR-MIDDLEWARE-URL/api/vehicle-funnel` |
| Vehicle list (for parts)| `GET https://YOUR-MIDDLEWARE-URL/api/vehicles` and `/api/vehicles/types` |

---

## Where to “go” in Lightspeed

1. Log into **Lightspeed eCom Back Office**.  
2. Open **Design** (or **Theme** / **Customize**) to change navigation and add links.  
3. Open **Content** → **Pages** (or equivalent) to create the “Shop Vehicles” and “Find My Vehicle” pages if you use iframes.  
4. Use the table above for the exact URLs once your middleware is deployed.

That’s the fun place to start: deploy the middleware, then in Lightspeed add the two links (or two pages with iframes) and point them at your middleware URL.
