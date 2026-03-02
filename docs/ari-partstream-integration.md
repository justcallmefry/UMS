# ARI Partstream integration — wire “Add to cart” to UMS middleware

This guide describes how to connect ARI Partstream’s “Add to cart” action to your UMS middleware so that diagram parts are added to your Ecwid cart and the customer is redirected to the cart.

## Callbacks and parameters (ARI Cart Integration)

ARI Partstream can integrate in two ways:

| Method | What ARI does | What you configure |
|--------|----------------|--------------------|
| **Cart URL (GET/POST)** | PartStream sends the user to a URL with part params (or POSTs them). | In PartStream setup, set **Cart URL** to `https://your-middleware.com/api/ari-add-to-cart`. |
| **JavaScript (AJAX/callback)** | PartStream calls a global function or your code receives part data. | Load the UMS bridge script and call `window.UMSAddFromDiagram(part)` with the part object. |

**ARI parameter names** (when using Cart URL or when ARI passes an object to your callback):  
`arisku` (part number), `ariprice`, `aridescription`, `ariqty`, `aribrand`, `arireturnurl` (return link). The middleware and bridge script accept these names.

## Flow

1. Customer views an ARI Partstream diagram on your storefront and selects a part.
2. Customer clicks **Add to cart** in the ARI embed.
3. Your storefront receives the part data (via ARI’s JavaScript callback or event).
4. The storefront calls your UMS middleware: `POST /api/add-from-diagram` with that part data.
5. Middleware finds or creates the product in Ecwid and returns a pre-filled cart URL.
6. The customer is redirected (or a new tab is opened) to that cart URL.

## 1. Add the bridge script to your storefront

Include the UMS ARI bridge script on **every page that embeds ARI Partstream** (e.g. diagram or parts lookup page).

- **Script location in repo:** `storefront-scripts/ums-ari-bridge.js`
- Deploy it to your storefront so it’s loaded from your domain (e.g. `https://yoursite.com/scripts/ums-ari-bridge.js`) or from the same host as your store.

**Example (HTML):**

```html
<script>
  // Configure before loading the bridge (optional)
  window.UMS_ARI_BRIDGE_CONFIG = {
    apiBase: 'https://your-ums-middleware.com',  // or http://localhost:3001 for dev
    siteId: null,                                 // set for multi-tenant, e.g. 'acme-powersports'
    openCartInNewTab: false,                     // true = open cart in new tab instead of redirect
  };
</script>
<script src="/scripts/ums-ari-bridge.js"></script>
```

**Ecwid / Company Site:** Add the above in your theme’s “Custom code” or “Footer/Header” so it runs on the pages where the ARI diagram is embedded.

## 2. Payload shape (middleware contract)

The bridge sends this JSON to `POST /api/add-from-diagram`:

| Field            | Required | Description |
|------------------|----------|-------------|
| `oemPartNumber`  | Yes      | OEM part number (used as Ecwid SKU). |
| `description`    | Yes      | Product name / description. |
| `price`          | Yes      | Number (e.g. 19.99). |
| `manufacturer`   | No       | Manufacturer name. |
| `vehicleSlug`    | No       | Vehicle slug from your vehicle list (e.g. `2023-yamaha-yz250f`). |
| `quantity`       | No       | Default 1. |

The bridge script accepts the same fields with alternate names from ARI:

- Part number: `oemPartNumber`, `partNumber`, or `sku`
- Description: `description` or `name`
- Price: `price`
- Manufacturer: `manufacturer` or `maker`
- Vehicle: `vehicleSlug` or `vehicle_slug`
- Quantity: `quantity`

## 3. Connect ARI’s “Add to cart” to the bridge

ARI Partstream’s exact callback depends on your ARI embed contract. Use one of the following.

### Option A: ARI calls a global function

If ARI is configured to call a global function when the user adds a part (e.g. `onAddToCart(part)`), point that to the UMS bridge:

```html
<script>
  window.UMS_ARI_BRIDGE_CONFIG = { apiBase: 'https://your-ums-middleware.com' };
</script>
<script src="/scripts/ums-ari-bridge.js"></script>
<script>
  // Replace "YourARICallback" with the actual callback name ARI expects
  window.YourARICallback = function(part) {
    window.UMSAddFromDiagram({
      oemPartNumber: part.partNumber,
      description: part.description,
      price: part.price,
      manufacturer: part.manufacturer,
      vehicleSlug: part.vehicleSlug,
      quantity: part.quantity || 1,
    });
  };
</script>
```

### Option B: Storefront listens for an ARI event and calls the bridge

If ARI dispatches a custom event or calls a function you define in the embed config:

```javascript
// When ARI fires its add-to-cart event, forward to UMS
document.addEventListener('ari-part-added', function(ev) {
  window.UMSAddFromDiagram(ev.detail);
});
```

Or call directly:

```javascript
window.UMSAddFromDiagram({
  oemPartNumber: '3514924',
  description: 'Polaris OEM Wheel Bearing 3514924',
  price: 49.99,
  manufacturer: 'Polaris',
  vehicleSlug: '2023-polaris-ranger-1000',
  quantity: 1,
});
```

### Option C: ARI “Cart URL” → redirect endpoint (recommended when PartStream uses GET/POST)

ARI Partstream can send part data via **HTTP GET or POST** to a “Cart URL” you configure in PartStream setup. The middleware exposes an endpoint that accepts ARI’s parameter names and redirects the customer to your Ecwid cart.

**ARI parameters (from ARI Cart Integration):**

| ARI key        | Meaning           | Required |
|----------------|-------------------|----------|
| `arisku`       | Part number (SKU) | Yes      |
| `aridescription` | Part description | Yes   |
| `ariprice`     | Price             | Yes      |
| `ariqty`       | Quantity          | No (default 1) |
| `aribrand`     | Manufacturer/brand | No     |
| `arireturnurl` | “Continue Shopping” return URL | No |

**Middleware endpoint:** `GET` or `POST` **`/api/ari-add-to-cart`**

- **GET:** PartStream can use a URL like  
  `https://your-middleware.com/api/ari-add-to-cart?arisku=3514924&aridescription=Polaris%20Wheel%20Bearing&ariprice=49.99&ariqty=1&aribrand=Polaris`
- **POST:** PartStream can POST the same keys as form or query; the middleware reads both.
- **Response:** 302 redirect to the Ecwid pre-filled cart. On error, redirects to `arireturnurl` if provided, or returns 400/500.

**PartStream setup:**

1. In PartStream setup, enable **“Connect to Ecommerce Cart”**.
2. Set **Cart URL** to your middleware redirect URL, e.g.  
   `https://your-ums-middleware.com/api/ari-add-to-cart`  
   (for multi-tenant append `?siteId=acme-powersports` or set it in PartStream “Preferred Keys” if ARI supports custom query params).
3. Use ARI’s default parameter names (`arisku`, `ariprice`, `aridescription`, `ariqty`, `aribrand`). The middleware maps these to the add-from-diagram payload. If your PartStream allows “Preferred Keys”, you can rename keys to match other carts; the route also accepts `sku`, `price`, `description`, `quantity`, `manufacturer`/`brand` as alternates.

No JavaScript is required on the storefront for this path: the user clicks Add to cart in the diagram and is sent to your middleware, which redirects to the Ecwid cart.

**Optional:** ARI also supports an **AJAX** add-to-cart option (no navigation). In that case the “Cart URL” may be called via XHR; the middleware would need to return JSON for AJAX. Currently `/api/ari-add-to-cart` always redirects. For AJAX, use the bridge script and `POST /api/add-from-diagram` (Option A/B) instead.

## 4. CORS and network

- The **middleware** must be reachable from the browser (same origin or CORS). The UMS middleware sends `Access-Control-Allow-Origin: *` for development.
- For production, deploy the middleware to a public URL (e.g. `https://api.yourdomain.com` or your hosting) and set `apiBase` in `UMS_ARI_BRIDGE_CONFIG` to that URL.
- If your storefront is on a different domain (e.g. Ecwid Company Site), ensure the middleware is deployed and that CORS allows your storefront origin (the current middleware allows all origins).

## 5. Multi-tenant (multiple sites)

If one middleware serves multiple storefronts, set `siteId` in the config so the middleware uses the correct store’s Ecwid credentials and vehicle data:

```javascript
window.UMS_ARI_BRIDGE_CONFIG = {
  apiBase: 'https://your-ums-middleware.com',
  siteId: 'acme-powersports',
};
```

The bridge sends `X-Site-Id: acme-powersports` on every request.

## 6. Testing without ARI

Use the mock page to simulate ARI calling the middleware:

- Open `middleware/ari-mock.html` in your browser (with the middleware running).
- Fill in part number, description, price, etc., and click **Send to /api/add-from-diagram**.
- You should get a `cartUrl` and can open the Ecwid cart with that part added.

Once the bridge script is on your storefront and ARI’s “Add to cart” is wired to `UMSAddFromDiagram` (or the custom event), the real flow will be: ARI → bridge → middleware → redirect to cart.
