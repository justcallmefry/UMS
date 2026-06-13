'use strict';
/**
 * Track A data pipeline.
 * CSV export -> (1) vehicle registry for the finder dropdowns, (2) per-product
 * fitment index for matching, (3) coverage report.
 * Run: `node fitment/build-data.js "<csv>" [outDir]`
 */
const fs = require('fs');
const path = require('path');
const { parseFitment, expandToVehicles, toKnownMake } = require('./parse');

const csvPath = process.argv[2];
const outDir = process.argv[3] || path.join(__dirname, '..', 'data', 'ums');
if (!csvPath) { console.error('Usage: node fitment/build-data.js "<csv>" [outDir]'); process.exit(1); }

function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const header = rows[0]; const idx = {}; header.forEach((h, i) => { idx[h] = i; });
const col = (r, n) => { const i = idx[n]; return i == null ? '' : (r[i] || '').trim(); };

const C = {
  type: 'type', sku: 'product_sku', name: 'product_name', brand: 'product_brand',
  ridingStyle: 'product_attribute_{Riding Style}', vehicle: 'product_attribute_Vehicle',
  machine: 'product_variation_option_Machine', cat: 'product_category_1',
  url: 'url', slug: 'custom_url_slug', image: 'product_media_main_image_url', price: 'product_price',
};

// Canonical vehicle types.
const TYPE_ORDER = ['Dirtbike', 'ATV', 'UTV', 'Street', 'ADV/Dualsport', 'Cruiser'];
const TYPE_MAP = {
  dirtbike: 'Dirtbike', dirtbikes: 'Dirtbike', atv: 'ATV', utv: 'UTV', sxs: 'UTV',
  street: 'Street', steet: 'Street', adv: 'ADV/Dualsport', dualsport: 'ADV/Dualsport',
  'adv dualsport': 'ADV/Dualsport', cruiser: 'Cruiser', crusier: 'Cruiser',
  'v-twin': 'Cruiser', vtwin: 'Cruiser', 'street cruiser': 'Cruiser', 'street touring': 'Street',
};
function normTypes(ridingStyle) {
  if (!ridingStyle) return [];
  return [...new Set(ridingStyle.split('/').map((s) => TYPE_MAP[s.trim().toLowerCase()]).filter(Boolean))];
}

// Walk product rows; attach variation Machine values.
const products = []; let cur = null;
for (let r = 1; r < rows.length; r++) {
  const row = rows[r]; const t = col(row, C.type);
  if (t === 'product') {
    cur = {
      sku: col(row, C.sku), name: col(row, C.name), brand: col(row, C.brand),
      cat: col(row, C.cat), url: col(row, C.url), slug: col(row, C.slug),
      image: col(row, C.image), price: col(row, C.price),
      types: normTypes(col(row, C.ridingStyle)),
      fitStrings: new Set(), machineStrings: new Set(),
    };
    const v = col(row, C.vehicle); if (v) cur.fitStrings.add(v);
    const m = col(row, C.machine); if (m) cur.machineStrings.add(m);
    products.push(cur);
  } else if (cur) {
    const m = col(row, C.machine); if (m) cur.machineStrings.add(m);
  }
}

// Build fitment index + vehicle registry.
const modelReg = new Map(); // key make|model -> {type counts, yearStart, yearEnd, openEnd}
const typeVotes = new Map(); // make|model -> {Type: count}
const index = [];
let nWithType = 0, nWithFit = 0, nConfident = 0, nUniversal = 0, nFailed = 0;
const failures = [];

const MAKE_LEAK = /^(Honda|Yamaha|Kawasaki|Suzuki|KTM|Polaris|Can-Am|Husqvarna|Husq|GasGas|Gas Gas|BMW|Triumph|CFMoto|Arctic Cat|Harley|Sherco|Beta)\b/i;

function cleanModelName(m) {
  let s = m
    .replace(/\b(all|models?|machines?|applications?|dirt\s?bikes?|bikes?|most|years?|big|larger|up)\b/gi, ' ')
    .replace(/others?\.*/gi, ' ').replace(/\.\.\./g, ' ')
    .replace(/^\s*and\b/i, ' ')
    .replace(/\s+\d{2,4}\s*[-–]\s*\d{2,4}\s*['’]?\s*$/, ' ')   // trailing bare year range "F 19-22"
    .replace(/^[\s\-–\/]+|[\s\-–,\/]+$/g, '')
    .replace(/\s+/g, ' ').trim();

  if (!s || s.length < 2) return null;
  if (!/[A-Za-z0-9]{2,}/.test(s)) return null;
  if (/^and\b/i.test(s)) return null;
  if (/^\//.test(s)) return null;                              // leftover leading slash
  if (/cc\b/i.test(s)) return null;                            // "125cc", "50cc"
  if (/^\d\s/.test(s)) return null;                            // "1 EXC", "1 XC"
  if (/^\d{2,3}\s*[-–]\s*\d{2,3}[A-Za-z]/.test(s)) return null; // displacement range "125-450SX" (not pickable)
  if (MAKE_LEAK.test(s)) return null;                          // cross-make leakage ("GasGas", "Husq ...")
  if (!/\d/.test(s) && /^[A-Z][A-Z\-\/]{0,4}$/.test(s)) return null; // bare ALL-CAPS stems (CR, CRF, SX, DR-Z, XCF-W)
  return s;
}

function regModel(make, model, yStart, yEnd, types) {
  const clean = cleanModelName(model);
  if (!clean) return;
  model = clean;
  const key = make + '|' + model.toLowerCase().replace(/\s+/g, ''); // dedup "PW 80" == "PW80"
  let e = modelReg.get(key);
  if (!e) { e = { make, model, yearStart: yStart, yearEnd: yEnd, openEnd: yEnd == null && yStart != null }; modelReg.set(key, e); }
  if (yStart != null) e.yearStart = e.yearStart == null ? yStart : Math.min(e.yearStart, yStart);
  if (yEnd == null && yStart != null) e.openEnd = true;
  else if (yEnd != null) e.yearEnd = e.yearEnd == null ? yEnd : Math.max(e.yearEnd, yEnd);
  const votes = typeVotes.get(key) || {};
  for (const ty of types) votes[ty] = (votes[ty] || 0) + 1;
  typeVotes.set(key, votes);
}

for (const p of products) {
  if (p.types.length) nWithType++;
  const allStrings = [...p.fitStrings, ...p.machineStrings];
  const brandMake = toKnownMake(p.brand); // only fall back to brand if it IS a vehicle make
  const parsed = allStrings.map((s) => parseFitment(s, { defaultMake: brandMake }));
  const hasFit = allStrings.length > 0;
  if (hasFit) {
    nWithFit++;
    if (parsed.some((x) => x.universal)) nUniversal++;
    else if (parsed.some((x) => x.confident)) nConfident++;
    else { nFailed++; if (failures.length < 40) failures.push([...allStrings][0]); }
  }
  const universal = parsed.some((x) => x.universal);
  const clauses = parsed.flatMap((x) => x.clauses);
  // Only index products that can ever match (have a type, a fitment clause, or are universal).
  if (p.types.length || clauses.length || universal) {
    const link = p.url || (p.slug ? 'https://www.unitedmotorsports.com/products/' + p.slug : '');
    index.push({
      sku: p.sku, name: p.name, brand: p.brand, cat: p.cat,
      url: link, image: p.image, price: p.price,
      types: p.types, universal, clauses,
    });
  }

  for (const x of parsed) {
    for (const v of expandToVehicles(x)) regModel(v.make, v.model, v.year, v.year, p.types);
    for (const c of x.clauses) {
      if (!c.makeLevel && c.make && c.models.length) {
        for (const m of c.models) regModel(c.make, m, c.yearStart, c.yearEnd, p.types);
      }
    }
  }
}

// Resolve a primary type per model.
const models = [...modelReg.entries()].map(([key, e]) => {
  const votes = typeVotes.get(key) || {};
  let best = null, bestN = -1;
  for (const ty of TYPE_ORDER) if ((votes[ty] || 0) > bestN) { best = ty; bestN = votes[ty] || 0; }
  return { type: best, make: e.make, model: e.model, yearStart: e.yearStart, yearEnd: e.openEnd ? null : e.yearEnd };
}).sort((a, b) => (a.make + a.model).localeCompare(b.make + b.model));

// Makes for the dropdown: every make seen in any clause (incl. make-level like Harley).
const makeSet = new Set(models.map((m) => m.make));
for (const p of index) for (const c of p.clauses) if (c.make) makeSet.add(c.make);
const makes = [...makeSet].sort();
const years = models.flatMap((m) => m.yearStart ? [m.yearStart, m.yearEnd || 2026] : []);
const minYear = years.length ? Math.min(...years) : null;
const maxYear = years.length ? Math.max(...years) : null;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'vehicles.json'), JSON.stringify({
  vehicleTypes: TYPE_ORDER.map((t) => ({ code: t, name: t })),
  makes, models, yearRange: [minYear, maxYear],
}, null, 0));
fs.writeFileSync(path.join(outDir, 'fitment-index.json'), JSON.stringify(index));
const coverage = {
  products: products.length,
  withType: nWithType, withFitment: nWithFit,
  parsedConfident: nConfident, universal: nUniversal, parseFailed: nFailed,
  distinctMakes: makes.length, distinctModels: models.length, yearRange: [minYear, maxYear],
};
fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(coverage, null, 2));

const pct = (n) => `${n} (${((n / products.length) * 100).toFixed(1)}%)`;
console.log('===== TRACK A DATA BUILD =====');
console.log(`Products:                 ${products.length}`);
console.log(`With vehicle type:        ${pct(nWithType)}`);
console.log(`With any fitment string:  ${pct(nWithFit)}`);
console.log(`  parsed confidently:     ${nConfident}`);
console.log(`  universal:              ${nUniversal}`);
console.log(`  parse failed:           ${nFailed}  (${((nFailed / Math.max(1, nWithFit)) * 100).toFixed(1)}% of fitment strings)`);
console.log(`\nVehicle registry: ${makes.length} makes, ${models.length} models, years ${minYear}-${maxYear}`);
console.log(`Makes: ${makes.join(', ')}`);
console.log(`\nModels per type:`);
for (const t of TYPE_ORDER) console.log(`  ${t.padEnd(14)} ${models.filter((m) => m.type === t).length}`);
console.log(`\nWrote: vehicles.json, fitment-index.json, coverage.json -> ${outDir}`);
console.log(`\nRemaining parse failures (sample):`);
failures.slice(0, 20).forEach((f) => console.log('  ' + JSON.stringify(f)));
