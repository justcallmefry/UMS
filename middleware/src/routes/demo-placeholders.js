/**
 * Demo placeholder routes for the vehicle funnel — dummy inventory, credit, and lead-echo
 * so you can show off the funnel without real provider URLs. Replace with real URLs in .env.
 */
const express = require('express');
const router = express.Router();

const INVENTORY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inventory — Demo placeholder</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; background: #f8fafc; }
    h1 { font-size: 1.1rem; color: #64748b; margin-bottom: 0.5rem; }
    .banner { background: #fef3c7; border: 1px solid #f59e0b; padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
    .year { color: #64748b; font-size: 0.85rem; }
    .price { font-weight: 600; color: #0f172a; }
  </style>
</head>
<body>
  <h1>Vehicle inventory (demo placeholder)</h1>
  <div class="banner">Replace VEHICLE_INVENTORY_EMBED_URL in .env with your real inventory provider embed URL.</div>
  <ul>
    <li><span><strong>2024 Yamaha YZ250F</strong> <span class="year">Dirt bike</span></span><span class="price">$8,299</span></li>
    <li><span><strong>2023 Honda CRF450R</strong> <span class="year">Dirt bike</span></span><span class="price">$9,599</span></li>
    <li><span><strong>2024 Kawasaki KX450</strong> <span class="year">Dirt bike</span></span><span class="price">$9,399</span></li>
    <li><span><strong>2024 Suzuki DR-Z400S</strong> <span class="year">Dual sport</span></span><span class="price">$7,299</span></li>
  </ul>
</body>
</html>`;

const CREDIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Credit application — Demo placeholder</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 480px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .banner { background: #dbeafe; border: 1px solid #3b82f6; padding: 0.75rem 1rem; border-radius: 6px; margin-top: 1rem; font-size: 0.9rem; color: #1e40af; }
  </style>
</head>
<body>
  <h1>Apply for financing</h1>
  <p>This is a demo placeholder. In production, customers would see your financing partner’s credit application here.</p>
  <div class="banner">Replace CREDIT_APP_URL in .env with your real credit application URL.</div>
</body>
</html>`;

// GET /demo/inventory-placeholder — iframe-friendly dummy inventory
router.get('/inventory-placeholder', (req, res) => {
  res.type('html').send(INVENTORY_HTML);
});

// GET /demo/credit-placeholder — dummy credit app page (link target)
router.get('/credit-placeholder', (req, res) => {
  res.type('html').send(CREDIT_HTML);
});

// POST /demo/lead-echo — accepts lead JSON, returns 200 (for demo LEAD_WEBHOOK_URL)
router.post('/lead-echo', express.json(), (req, res) => {
  console.log('[demo] Lead received:', req.body);
  res.status(200).json({ ok: true, message: 'Demo: lead logged (replace LEAD_WEBHOOK_URL with your CRM webhook).' });
});

module.exports = router;
