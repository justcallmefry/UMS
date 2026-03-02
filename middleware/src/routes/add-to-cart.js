/**
 * Add-from-diagram: accept part payload (from ARI or storefront), find-or-create
 * product in Ecwid or Lightspeed, then return cart (or product) redirect URL.
 * See docs/technical-architecture.md and docs/ari-partstream-integration.md.
 */
const express = require('express');
const router = express.Router();
const {
  getStoreProfile,
  findOrCreateProductBySku: ecwidFindOrCreate,
  buildPrefilledCartUrl,
} = require('../lib/ecwid');
const {
  getLightspeedConfig,
  findOrCreateProductBySku: lightspeedFindOrCreate,
  buildProductPageUrl: lightspeedProductPageUrl,
} = require('../lib/lightspeed');

// Expected payload shape (from ARI or storefront):
// {
//   oemPartNumber, description, price, manufacturer?,
//   vehicleSlug?, quantity?, cartId?
// }

/** True if this tenant (or env) should use Lightspeed instead of Ecwid. */
function useLightspeed(tenant) {
  if (tenant?.lightspeed?.apiKey) return true;
  if (tenant?.lightspeed?.apiSecret && process.env.LIGHTSPEED_API_KEY) return true;
  if (process.env.LIGHTSPEED_API_KEY && process.env.LIGHTSPEED_API_SECRET) return true;
  return false;
}

/**
 * Shared logic: find-or-create product (Ecwid or Lightspeed) and build redirect URL.
 * @returns {{ cartUrl, product, store, platform: 'ecwid'|'lightspeed' }}
 */
async function addFromDiagram(tenant, payload) {
  const {
    oemPartNumber,
    description,
    price,
    manufacturer,
    vehicleSlug,
    quantity = 1,
  } = payload;

  if (!oemPartNumber || !description || price == null) {
    const err = new Error('Missing required fields: oemPartNumber, description, price');
    err.status = 400;
    throw err;
  }

  const productPayload = {
    sku: oemPartNumber,
    name: description,
    price,
    description: manufacturer
      ? `${description} — ${manufacturer}${vehicleSlug ? ` (${vehicleSlug})` : ''}`
      : description,
  };

  if (useLightspeed(tenant)) {
    const config = getLightspeedConfig(tenant);
    const product = await lightspeedFindOrCreate(tenant, productPayload);
    const cartUrl = lightspeedProductPageUrl(tenant, product) || config.storeUrl;
    return {
      cartUrl,
      product: {
        id: product.id,
        variantId: product.variantId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        url: product.url,
      },
      store: {
        id: null,
        name: null,
        url: config.storeUrl,
      },
      platform: 'lightspeed',
    };
  }

  const ecwidProfile = await getStoreProfile(tenant);
  const storeUrlFromProfile = ecwidProfile?.settings?.storeUrl || null;
  const storeUrl =
    storeUrlFromProfile ||
    tenant?.cartRedirectBase ||
    process.env.STORE_CART_URL ||
    'https://your-store.com';

  const product = await ecwidFindOrCreate(tenant, productPayload);
  const cartUrl = buildPrefilledCartUrl({
    storeUrl,
    products: [{ id: product.id, quantity }],
    gotoCheckout: false,
  });

  return {
    cartUrl,
    product,
    store: {
      id: ecwidProfile?.generalInfo?.storeId || null,
      name: ecwidProfile?.generalInfo?.storeName || null,
      url: storeUrlFromProfile,
    },
    platform: 'ecwid',
  };
}

// ——— POST /api/add-from-diagram (JSON body; for bridge script / API clients) ———
router.post('/add-from-diagram', async (req, res) => {
  const body = req.body || {};
  const {
    oemPartNumber,
    description,
    price,
    manufacturer,
    vehicleSlug,
    quantity = 1,
    cartId,
  } = body;

  if (!oemPartNumber || !description || price == null) {
    return res.status(400).json({
      error: 'Missing required fields: oemPartNumber, description, price',
    });
  }

  try {
    const result = await addFromDiagram(req.tenant, {
      oemPartNumber,
      description,
      price,
      manufacturer,
      vehicleSlug,
      quantity,
    });

    const isLightspeed = result.platform === 'lightspeed';
    res.json({
      ok: true,
      message: isLightspeed
        ? 'Lightspeed product found or created. Redirect customer to cartUrl (product page) to add to cart.'
        : 'Ecwid product found or created and pre-filled cart URL generated. Redirect customer to cartUrl to show the item in cart.',
      cartUrl: result.cartUrl,
      platform: result.platform,
      ecwidStore: result.platform === 'ecwid' ? result.store : undefined,
      lightspeedStore: result.platform === 'lightspeed' ? result.store : undefined,
      product: result.product,
      received: {
        oemPartNumber,
        description,
        price,
        manufacturer: manufacturer || null,
        vehicleSlug: vehicleSlug || null,
        quantity,
        cartId: cartId || null,
      },
    });
  } catch (err) {
    console.error('Error handling add-from-diagram:', err);
    const status = err.status || 500;
    return res.status(status).json({
      ok: false,
      error: err.message || 'Failed to process add-from-diagram request',
      details: err.body || null,
    });
  }
});

// ——— ARI Partstream callback: GET or POST with ARI parameter names → 302 redirect to cart ———
// ARI passes: arisku, ariprice, aridescription, ariqty, aribrand, arireturnurl (optional).
// Configure PartStream "Cart URL" to this endpoint (e.g. https://your-middleware.com/api/ari-add-to-cart).
function mapAriParamsToPayload(queryOrBody) {
  const arisku = queryOrBody.arisku || queryOrBody.sku;
  const ariprice = queryOrBody.ariprice || queryOrBody.price;
  const aridescription = queryOrBody.aridescription || queryOrBody.description;
  const ariqty = queryOrBody.ariqty != null ? queryOrBody.ariqty : queryOrBody.quantity;
  const aribrand = queryOrBody.aribrand || queryOrBody.manufacturer || queryOrBody.brand;
  return {
    oemPartNumber: arisku,
    description: aridescription,
    price: ariprice != null && ariprice !== '' ? Number(ariprice) : undefined,
    manufacturer: aribrand || undefined,
    quantity: ariqty != null && ariqty !== '' ? Math.max(1, parseInt(ariqty, 10)) : 1,
  };
}

router.all('/ari-add-to-cart', async (req, res) => {
  const params = req.method === 'GET' ? req.query : { ...req.query, ...req.body };
  const arireturnurl = params.arireturnurl || params.returnurl;

  const payload = mapAriParamsToPayload(params);
  if (!payload.oemPartNumber || !payload.description || payload.price == null) {
    if (arireturnurl) return res.redirect(302, arireturnurl);
    return res.status(400).send('Missing ARI params: arisku, aridescription, ariprice');
  }

  try {
    const result = await addFromDiagram(req.tenant, payload);
    return res.redirect(302, result.cartUrl);
  } catch (err) {
    console.error('Error in ARI add-to-cart:', err);
    if (arireturnurl) return res.redirect(302, arireturnurl);
    const status = err.status || 500;
    return res.status(status).send(err.message || 'Failed to add part to cart');
  }
});

module.exports = router;
