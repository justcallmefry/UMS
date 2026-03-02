/**
 * Lightspeed eCom API client (minimal for add-from-diagram).
 * Uses API key + secret (Basic auth). Cluster: api.shoplightspeed.com (US) or api.webshopapp.com (EU).
 * See https://developers.lightspeedhq.com/ecom/introduction/authentication/
 */
const path = require('path');

if (!process.env.LIGHTSPEED_API_KEY) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
  } catch (_) {}
}

const CLUSTER_US = 'https://api.shoplightspeed.com';
const CLUSTER_EU = 'https://api.webshopapp.com';

function getLightspeedConfig(tenant) {
  const ls = tenant?.lightspeed;
  const apiKey = ls?.apiKey || process.env.LIGHTSPEED_API_KEY;
  const apiSecret = ls?.apiSecret || process.env.LIGHTSPEED_API_SECRET;
  const cluster = (ls?.cluster || process.env.LIGHTSPEED_CLUSTER || 'us').toLowerCase();
  const baseUrl =
    (ls?.baseUrl || process.env.LIGHTSPEED_BASE_URL) ||
    (cluster === 'eu' ? CLUSTER_EU : CLUSTER_US);
  const language = ls?.language || process.env.LIGHTSPEED_LANGUAGE || 'en';
  const storeUrl = ls?.storeUrl || process.env.LIGHTSPEED_APP_URL || process.env.STORE_CART_URL;

  if (!apiKey || !apiSecret) {
    throw new Error('Lightspeed config error: LIGHTSPEED_API_KEY and LIGHTSPEED_API_SECRET are required.');
  }

  return {
    apiKey,
    apiSecret,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    language: language.replace(/^\/+|\/+$/g, '') || 'en',
    storeUrl: storeUrl || 'https://your-store.com',
  };
}

function getAuthHeader(tenant) {
  const { apiKey, apiSecret } = getLightspeedConfig(tenant);
  const encoded = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Call Lightspeed eCom API. Path is e.g. "/products.json" or "/variants.json?product=123".
 */
async function callLightspeed(tenant, pathSuffix, options = {}) {
  const { baseUrl, language } = getLightspeedConfig(tenant);
  const prefix = pathSuffix.startsWith('/') ? '' : '/';
  const pathWithLang = `/${language}${prefix}${pathSuffix}`.replace(/\/+/g, '/');
  const url = `${baseUrl}${pathWithLang}`;

  const headers = {
    Authorization: getAuthHeader(tenant),
    ...(options.headers || {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Lightspeed API error ${response.status} ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
}

/**
 * Search variants by SKU (paginate and filter client-side; API has no SKU filter).
 */
async function findVariantBySku(tenant, sku) {
  if (!sku) return null;
  let page = 1;
  const limit = 250;
  while (true) {
    const res = await callLightspeed(
      tenant,
      `variants.json?limit=${limit}&page=${page}&fields=id,product,sku,priceIncl,priceExcl,title`
    );
    const list = res?.variants ?? (Array.isArray(res) ? res : []);
    const variant = list.find((v) => (v.sku || '').toString().trim() === sku.toString().trim());
    if (variant) return variant;
    if (list.length < limit) break;
    page++;
    if (page > 20) break; // safety
  }
  return null;
}

/**
 * Get product by ID (minimal fields).
 */
async function getProduct(tenant, productId) {
  const res = await callLightspeed(
    tenant,
    `products/${productId}.json?fields=id,url,title,fulltitle`
  );
  return res?.product || res;
}

/**
 * Create product (no variant yet).
 */
async function createProduct(tenant, { title, description, content }) {
  const body = {
    product: {
      visibility: 'visible',
      title: title || 'Untitled',
      fulltitle: title || 'Untitled',
      description: (description || '').slice(0, 255),
      content: content || '',
    },
  };
  const res = await callLightspeed(tenant, 'products.json', { method: 'POST', body });
  return res?.product || res;
}

/**
 * Create variant for a product (SKU + price).
 */
async function createVariant(tenant, productId, { sku, price }) {
  const body = {
    variant: {
      product: productId,
      sku: (sku || '').toString(),
      priceIncl: Number(price),
      priceExcl: Number(price),
      stockTracking: 'disabled',
    },
  };
  const res = await callLightspeed(tenant, 'variants.json', { method: 'POST', body });
  return res?.variant || res;
}

/**
 * Find product by variant ID (variant has product id in response).
 */
async function getProductIdFromVariant(tenant, variantId) {
  const res = await callLightspeed(tenant, `variants/${variantId}.json?fields=id,product`);
  const v = res?.variant || res;
  return v?.product?.id ?? v?.product;
}

/**
 * Find or create product+variant by SKU. Returns { id, sku, name, price, url, variantId }
 * suitable for building a product page URL (Lightspeed has no pre-filled cart API; we link to product page).
 */
async function findOrCreateProductBySku(tenant, { sku, name, price, description }) {
  const config = getLightspeedConfig(tenant);
  const existing = await findVariantBySku(tenant, sku);
  if (existing) {
    const productId = existing.product?.id ?? (await getProductIdFromVariant(tenant, existing.id));
    const product = productId ? await getProduct(tenant, productId) : null;
    const productUrl = product?.url ? `products/${product.url}` : `products/${productId}`;
    return {
      id: productId,
      variantId: existing.id,
      sku: existing.sku,
      name: (product?.title || product?.fulltitle) || name,
      price: existing.priceIncl ?? existing.priceExcl ?? price,
      url: `${config.storeUrl.replace(/\/+$/, '')}/${productUrl}`,
    };
  }

  const product = await createProduct(tenant, {
    title: name,
    description: (description || name).slice(0, 255),
    content: description || '',
  });
  const productId = product.id;
  const variant = await createVariant(tenant, productId, { sku, price });
  const productUrl = product.url ? `products/${product.url}` : `products/${productId}`;

  return {
    id: productId,
    variantId: variant.id,
    sku,
    name: product.title || name,
    price,
    url: `${config.storeUrl.replace(/\/+$/, '')}/${productUrl}`,
  };
}

/**
 * Build "cart" redirect URL for Lightspeed: we use the product page URL so the customer can add to cart there.
 * (Lightspeed eCom has no public pre-filled cart URL API.)
 */
function buildProductPageUrl(tenant, productResult) {
  return productResult?.url || null;
}

module.exports = {
  getLightspeedConfig,
  callLightspeed,
  findVariantBySku,
  getProduct,
  createProduct,
  createVariant,
  findOrCreateProductBySku,
  buildProductPageUrl,
};
