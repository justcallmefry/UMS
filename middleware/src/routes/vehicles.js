/**
 * Serves vehicle types and vehicle list from static JSON (Option A).
 * Multi-tenant: when req.tenant is set (X-Site-Id or config/sites.json), uses that site's vehicle paths.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const { REPO_ROOT } = require('../lib/tenant');

const DEFAULT_VEHICLES_PATH = path.join(REPO_ROOT, 'data', 'vehicles.json');
const DEFAULT_TYPES_PATH = path.join(REPO_ROOT, 'data', 'vehicle-types.json');

function loadJsonFromPath(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(raw);
}

function getPaths(req) {
  const tenant = req.tenant;
  if (tenant?.vehicles?.path && tenant?.vehicleTypesPath) {
    return {
      vehicles: path.join(REPO_ROOT, tenant.vehicles.path),
      types: path.join(REPO_ROOT, tenant.vehicleTypesPath),
    };
  }
  return { vehicles: DEFAULT_VEHICLES_PATH, types: DEFAULT_TYPES_PATH };
}

// GET /api/vehicles/types — list vehicle types (dirtbike, atv, utv, ...)
router.get('/types', (req, res) => {
  try {
    const { types } = getPaths(req);
    const { vehicleTypes } = loadJsonFromPath(types);
    res.json({ vehicleTypes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vehicle types' });
  }
});

// GET /api/vehicles — list all vehicles (optional ?type=dirtbike filter)
router.get('/', (req, res) => {
  try {
    const { vehicles } = getPaths(req);
    const { vehicles: list } = loadJsonFromPath(vehicles);
    const type = req.query.type;
    const out = type ? list.filter((v) => v.type === type) : list;
    res.json({ vehicles: out });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vehicles' });
  }
});

// GET /api/vehicles/by-slug/:slug — get one vehicle by slug (e.g. 2023-yamaha-yz250f)
router.get('/by-slug/:slug', (req, res) => {
  try {
    const { vehicles } = getPaths(req);
    const { vehicles: list } = loadJsonFromPath(vehicles);
    const vehicle = list.find((v) => v.slug === req.params.slug);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vehicles' });
  }
});

module.exports = router;
