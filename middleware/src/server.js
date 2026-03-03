/**
 * UMS Middleware — add-from-diagram and vehicle list API.
 * Serves vehicle data (Option A static list) and will handle ARI → Lightspeed add-to-cart.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');

const vehicleRoutes = require('./routes/vehicles');
const addToCartRoutes = require('./routes/add-to-cart');
const vehicleFunnelRoutes = require('./routes/vehicle-funnel');
const demoPlaceholders = require('./routes/demo-placeholders');

const app = express();
const PORT = process.env.PORT || 3001;

// Very permissive CORS for local development so browser-based tools
// (like ari-mock.html) can call the API from file:// or http:// origins.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, X-Site-Id'
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ARI Partstream may POST form-encoded

// Multi-tenant: resolve site from X-Site-Id header or ?siteId= (see docs/productization-multi-tenant.md)
const { resolveFromRequest } = require('./lib/tenant');
app.use((req, res, next) => {
  req.tenant = resolveFromRequest(req);
  next();
});

// Vehicle list and types (Option A static data; per-tenant when config/sites.json is used)
app.use('/api/vehicles', vehicleRoutes);

// Add from diagram → create product in Ecwid/Lightspeed → add to cart
app.use('/api', addToCartRoutes);

// Vehicle funnel — inventory embed URL, lead webhook, credit app URL (no cart)
app.use('/api', vehicleFunnelRoutes);

// Demo placeholders for vehicle funnel (dummy inventory, credit, lead-echo)
app.use('/demo', demoPlaceholders);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ums-middleware' });
});

// Root: redirect to showcase so the base URL isn’t “Not found”
app.get('/', (req, res) => {
  res.redirect(302, '/showcase');
});

// Storefront pages (same host as API — no CORS, no API base config needed)
const storefrontDir = path.join(__dirname, '..', '..', 'storefront-scripts');
app.get('/shop-vehicles', (req, res) => {
  res.sendFile(path.join(storefrontDir, 'shop-vehicles.html'), (err) => {
    if (err) res.status(404).send('Shop Vehicles page not found');
  });
});
app.get('/find-my-vehicle', (req, res) => {
  res.sendFile(path.join(storefrontDir, 'find-my-vehicle.html'), (err) => {
    if (err) res.status(404).send('Find My Vehicle page not found');
  });
});
app.get('/find-my-vehicle-nav', (req, res) => {
  res.sendFile(path.join(storefrontDir, 'find-my-vehicle-nav.html'), (err) => {
    if (err) res.status(404).send('Find My Vehicle nav widget not found');
  });
});
app.get('/showcase', (req, res) => {
  res.sendFile(path.join(storefrontDir, 'ums-showcase.html'), (err) => {
    if (err) res.status(404).send('Showcase page not found');
  });
});

app.listen(PORT, () => {
  console.log(`UMS middleware listening on http://localhost:${PORT}`);
});
