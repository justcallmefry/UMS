/**
 * Multi-tenant: resolve site config by siteId (header, query, or default).
 * Supports one codebase serving many Lightspeed stores.
 * See docs/productization-multi-tenant.md.
 */
const path = require('path');
const fs = require('fs');

// From middleware/src/lib: ../../.. = repo root (UMS)
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CONFIG_PATH = path.join(REPO_ROOT, 'config', 'sites.json');
const CONFIG_EXAMPLE_PATH = path.join(REPO_ROOT, 'config', 'sites.example.json');

let cachedConfig = null;

function loadSitesConfig() {
  if (cachedConfig) return cachedConfig;
  const pathToUse = fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : CONFIG_EXAMPLE_PATH;
  const raw = fs.readFileSync(pathToUse, 'utf8');
  const parsed = JSON.parse(raw);
  cachedConfig = parsed;
  return parsed;
}

function resolveEnv(value) {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\$\{(.+)\}$/);
  if (!match) return value;
  return process.env[match[1]] ?? value;
}

function resolveEnvInObject(obj) {
  if (obj === null || typeof obj !== 'object') return resolveEnv(obj);
  if (Array.isArray(obj)) return obj.map(resolveEnvInObject);
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = resolveEnvInObject(v);
  return out;
}

/**
 * Get config for a site by siteId.
 * @param {string} siteId - e.g. "acme-powersports" or "default"
 * @returns {object|null} Site config with env vars resolved, or null if not found.
 */
function getSiteConfig(siteId) {
  const config = loadSitesConfig();
  const site = config.sites?.find((s) => s.siteId === siteId);
  if (!site) return null;
  return resolveEnvInObject(site);
}

/**
 * Resolve tenant from request: X-Site-Id header, then query ?siteId=, then default from config.
 * @param {object} req - Express request
 * @returns {object|null} Resolved site config or null (caller can fall back to env).
 */
function resolveFromRequest(req) {
  const config = loadSitesConfig();
  const siteId = req.get('X-Site-Id') || req.query.siteId || config.defaultSiteId || 'default';
  return getSiteConfig(siteId);
}

module.exports = { getSiteConfig, resolveFromRequest, loadSitesConfig, REPO_ROOT };
