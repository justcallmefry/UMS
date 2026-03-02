/**
 * UMS ARI Partstream bridge — storefront script
 *
 * Call this when the customer clicks "Add to cart" in the ARI Partstream embed.
 * It POSTs the part to your UMS middleware and redirects the customer to the
 * store cart (Ecwid pre-filled cart URL).
 *
 * Usage:
 *   1. Load this script on the page that embeds ARI Partstream.
 *   2. Configure UMS_ARI_BRIDGE_CONFIG (see below).
 *   3. When ARI fires "Add to cart", call:
 *        window.UMSAddFromDiagram(payload)
 *      or dispatch a custom event:
 *        window.dispatchEvent(new CustomEvent('ums-add-from-diagram', { detail: payload }));
 *
 * Payload shape (same as POST /api/add-from-diagram):
 *   { oemPartNumber, description, price, manufacturer?, vehicleSlug?, quantity? }
 *
 * See docs/ari-partstream-integration.md for full setup.
 */
(function () {
  'use strict';

  // ——— Config (set before loading this script, or override on window) ———
  window.UMS_ARI_BRIDGE_CONFIG = window.UMS_ARI_BRIDGE_CONFIG || {
    // Base URL of your UMS middleware (no trailing slash)
    apiBase: 'http://localhost:3001',
    // Optional: multi-tenant site id (sent as X-Site-Id header)
    siteId: null,
    // If true, open cart in a new tab instead of redirecting current window
    openCartInNewTab: false,
  };

  var CONFIG = window.UMS_ARI_BRIDGE_CONFIG;

  function getApiUrl() {
    return (CONFIG.apiBase || '').replace(/\/+$/, '') + '/api/add-from-diagram';
  }

  function buildPayload(part) {
    return {
      oemPartNumber: part.oemPartNumber || part.partNumber || part.sku || part.arisku,
      description: part.description || part.name || part.aridescription || '',
      price: part.price != null ? Number(part.price) : (part.ariprice != null ? Number(part.ariprice) : undefined),
      manufacturer: part.manufacturer || part.maker || part.aribrand || null,
      vehicleSlug: part.vehicleSlug || part.vehicle_slug || null,
      quantity: part.quantity != null ? Math.max(1, parseInt(part.quantity, 10)) : (part.ariqty != null ? Math.max(1, parseInt(part.ariqty, 10)) : 1),
    };
  }

  function handleResponse(result) {
    if (!result || result.ok !== true || !result.cartUrl) {
      var msg = (result && result.error) || (result && result.message) || 'Could not add part to cart.';
      if (typeof console !== 'undefined' && console.error) console.error('UMS add-from-diagram:', msg);
      if (typeof window.alert === 'function') window.alert(msg);
      return;
    }
    if (CONFIG.openCartInNewTab) {
      window.open(result.cartUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = result.cartUrl;
    }
  }

  /**
   * Call this with the part payload when ARI fires "Add to cart".
   * @param {object} part - Part data from ARI or your mapping.
   *   Must include: oemPartNumber (or partNumber/sku), description (or name), price.
   *   Optional: manufacturer, vehicleSlug, quantity.
   */
  function UMSAddFromDiagram(part) {
    if (!part || typeof part !== 'object') {
      if (typeof console !== 'undefined' && console.error) console.error('UMSAddFromDiagram: part object required');
      return;
    }

    var payload = buildPayload(part);
    if (!payload.oemPartNumber || !payload.description || payload.price == null) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('UMSAddFromDiagram: missing oemPartNumber, description, or price', payload);
      }
      return;
    }

    var url = getApiUrl();
    var headers = { 'Content-Type': 'application/json' };
    if (CONFIG.siteId) headers['X-Site-Id'] = CONFIG.siteId;

    fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      mode: 'cors',
    })
      .then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok) {
            var err = new Error(json.error || json.message || 'Request failed');
            err.response = json;
            throw err;
          }
          return json;
        });
      })
      .then(handleResponse)
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.error) console.error('UMS add-from-diagram:', err);
        if (typeof window.alert === 'function') {
          window.alert('Could not add part to cart. Check console or try again.');
        }
      });
  }

  window.UMSAddFromDiagram = UMSAddFromDiagram;

  // Optional: listen for custom event so storefront can forward ARI callback
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('ums-add-from-diagram', function (ev) {
      if (ev.detail) UMSAddFromDiagram(ev.detail);
    });
  }
})();
