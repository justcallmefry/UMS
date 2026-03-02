/**
 * Vehicle funnel API — inventory embed URL, lead capture, credit app URL.
 * No cart; used for "Shop Vehicles" path (lead gen, inventory iframe, credit application).
 * See docs/technical-architecture.md and docs/vehicle-funnel-integration.md.
 */
const express = require('express');
const router = express.Router();

// Treat unresolved env placeholders (e.g. "${VAR}") as null so storefront doesn't use them as URLs
function asUrl(value) {
  if (value == null || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\$\{[^}]+\}$/.test(trimmed) || /^\$\([^)]+\)$/.test(trimmed)) return null;
  return trimmed;
}

function getVehicleFunnelConfig(tenant) {
  const funnel = tenant?.vehicleFunnel || {};
  return {
    inventoryEmbedUrl:
      asUrl(funnel.inventoryEmbedUrl) ||
      asUrl(process.env.VEHICLE_INVENTORY_EMBED_URL) ||
      null,
    leadWebhookUrl:
      asUrl(funnel.leadWebhookUrl) ||
      asUrl(process.env.LEAD_WEBHOOK_URL) ||
      null,
    creditAppUrl:
      asUrl(funnel.creditAppUrl) ||
      asUrl(process.env.CREDIT_APP_URL) ||
      null,
  };
}

// GET /api/vehicle-funnel — URLs for storefront to embed inventory, post leads, link to credit app
router.get('/vehicle-funnel', (req, res) => {
  const config = getVehicleFunnelConfig(req.tenant);
  res.json({
    ok: true,
    vehicleFunnel: config,
  });
});

// POST /api/lead — forward lead payload to configured webhook (optional proxy for forms)
router.post('/lead', (req, res) => {
  const webhookUrl =
    req.tenant?.vehicleFunnel?.leadWebhookUrl || process.env.LEAD_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(501).json({
      ok: false,
      error: 'Lead capture not configured. Set LEAD_WEBHOOK_URL or tenant.vehicleFunnel.leadWebhookUrl.',
    });
  }

  const payload = req.body || {};
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`Webhook returned ${r.status}`);
      return res.status(200).json({ ok: true, message: 'Lead submitted.' });
    })
    .catch((err) => {
      console.error('Lead webhook error:', err);
      res.status(502).json({
        ok: false,
        error: 'Failed to submit lead to CRM.',
      });
    });
});

module.exports = router;
