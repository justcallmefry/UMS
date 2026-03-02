/**
 * Ecwid API client (minimal for first slice).
 * Uses STORE_ID and ECWID_SECRET_TOKEN from env.
 */
const path = require('path');
const API_BASE = 'https://app.ecwid.com/api/v3';

// Ensure .env is loaded from middleware folder (works even if server was started from repo root)
if (!process.env.STORE_ID) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

function getEcwidConfig(tenant) {
  // For now we just use env-based config; we can extend this
  // later to look at tenant-specific settings in sites.json.
  const storeId =
    tenant?.ecwid?.storeId ||
    tenant?.storeId ||
    process.env.STORE_ID ||
    '131197020'; // fallback to pilot store ID so we can move forward even if env is misconfigured
  const token = process.env.ECWID_SECRET_TOKEN;

  if (!token) {
    throw new Error(
      'Ecwid config error: ECWID_SECRET_TOKEN is not set in environment.'
    );
  }

  return { storeId, token };
}

async function callEcwid(tenant, pathSuffix, options = {}) {
  const { storeId, token } = getEcwidConfig(tenant);
  const url = `${API_BASE}/${storeId}${pathSuffix}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const message =
      (json && json.errorMessage) ||
      `Ecwid API error ${response.status} ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.body = json;
    throw err;
  }

  return json;
}

async function getStoreProfile(tenant) {
  return callEcwid(tenant, '/profile');
}

async function searchProductBySku(tenant, sku) {
  if (!sku) return null;

  const query = new URLSearchParams();
  // Use keyword search and then filter by sku; avoids relying on SKU-specific params.
  query.set('keyword', sku);
  query.set('limit', '100');
  query.set(
    'responseFields',
    'total,items(id,sku,name,price,url,enabled,inStock,unlimited)'
  );

  const result = await callEcwid(tenant, `/products?${query.toString()}`);
  const items = result?.items || [];
  if (!items.length) return null;

  // Prefer exact SKU match; fall back to first item if none.
  return items.find((p) => p.sku === sku) || items[0];
}

async function createProduct(tenant, { sku, name, price, description }) {
  const body = {
    sku,
    name,
    price,
    description,
    enabled: true,
    unlimited: true,
    // We keep this first slice minimal; taxes/shipping/categories can be wired later.
  };

  const created = await callEcwid(tenant, '/products', {
    method: 'POST',
    body,
  });

  return created;
}

async function findOrCreateProductBySku(tenant, { sku, name, price, description }) {
  const existing = await searchProductBySku(tenant, sku);
  if (existing) {
    return {
      id: existing.id,
      sku: existing.sku,
      name: existing.name,
      price: existing.price,
      url: existing.url,
    };
  }

  const created = await createProduct(tenant, { sku, name, price, description });

  // We only know the new product ID from the create call; return minimal info.
  return { id: created.id, sku, name, price };
}

function buildPrefilledCartUrl({ storeUrl, products, gotoCheckout = false }) {
  if (!storeUrl) {
    throw new Error('Ecwid storeUrl is required to build a pre-filled cart URL.');
  }
  if (!Array.isArray(products) || !products.length) {
    throw new Error('At least one product is required to build a pre-filled cart URL.');
  }

  const normalizedBase = storeUrl.replace(/\/+$/, '');
  const cartPageLink = `${normalizedBase}/#!/~/cart/create=`;

  const cart = {
    gotoCheckout,
    products: products.map((p) => ({
      id: p.id,
      quantity: p.quantity || 1,
      ...(p.options ? { options: p.options } : {}),
    })),
  };

  const cartCode = encodeURIComponent(JSON.stringify(cart));
  return `${cartPageLink}${cartCode}`;
}

module.exports = {
  getEcwidConfig,
  callEcwid,
  getStoreProfile,
  searchProductBySku,
  createProduct,
  findOrCreateProductBySku,
  buildPrefilledCartUrl,
};
