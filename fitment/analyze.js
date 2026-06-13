'use strict';
/**
 * Catalog fitment coverage analyzer.
 * Reads the Ecwid/Lightspeed product CSV export and reports how much usable
 * vehicle-fitment data exists, what shape it's in, and how well the normalizer
 * parses it. Run: `node fitment/analyze.js "<path-to-csv>"`.
 */
const fs = require('fs');
const { normalizeFitment } = require('./normalize');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node fitment/analyze.js "<path-to-catalog.csv>"');
  process.exit(1);
}

// --- Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas/newlines, "" escapes, CRLF). ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // swallow; \n handles the row break
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const raw = fs.readFileSync(csvPath, 'utf8');
const rows = parseCsv(raw);
const header = rows[0];
const idx = {};
header.forEach((h, i) => { idx[h] = i; });

function col(row, name) {
  const i = idx[name];
  return i == null ? '' : (row[i] == null ? '' : row[i].trim());
}

const COL = {
  type: 'type',
  sku: 'product_sku',
  name: 'product_name',
  brand: 'product_brand',
  ridingStyle: 'product_attribute_{Riding Style}',
  vehicle: 'product_attribute_Vehicle',
  rmPart: 'product_attribute_{RM Part#}',
  cat1: 'product_category_1',
  machine: 'product_variation_option_Machine',
  varYear: 'product_variation_option_Year',
  varModel: 'product_variation_option_Model',
  varYMM: 'product_variation_option_{Year - Make - Model}',
};

// Row "type" breakdown.
const typeCounts = {};
for (let r = 1; r < rows.length; r++) {
  const t = col(rows[r], COL.type) || '(blank)';
  typeCounts[t] = (typeCounts[t] || 0) + 1;
}

// Walk rows: a product row starts a product; following variation/option rows attach to it.
const products = [];
let cur = null;
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const t = col(row, COL.type);
  const sku = col(row, COL.sku);
  const name = col(row, COL.name);
  if (t === 'product') {
    cur = {
      sku, name,
      brand: col(row, COL.brand),
      ridingStyle: col(row, COL.ridingStyle),
      vehicle: col(row, COL.vehicle),
      rmPart: col(row, COL.rmPart),
      cat1: col(row, COL.cat1),
      machines: new Set(),
      varYears: new Set(),
      varModels: new Set(),
      varYMM: new Set(),
    };
    const m = col(row, COL.machine); if (m) cur.machines.add(m);
    const y = col(row, COL.varYear); if (y) cur.varYears.add(y);
    const md = col(row, COL.varModel); if (md) cur.varModels.add(md);
    const ymm = col(row, COL.varYMM); if (ymm) cur.varYMM.add(ymm);
    products.push(cur);
  } else if (cur) {
    const m = col(row, COL.machine); if (m) cur.machines.add(m);
    const y = col(row, COL.varYear); if (y) cur.varYears.add(y);
    const md = col(row, COL.varModel); if (md) cur.varModels.add(md);
    const ymm = col(row, COL.varYMM); if (ymm) cur.varYMM.add(ymm);
  }
}

// --- Coverage tallies ---
let withVehicle = 0, withRidingStyle = 0, withMachine = 0, withVarYMM = 0, withVarYear = 0;
let parseConfident = 0, parseUniversal = 0, parseFail = 0;
const ridingStyleValues = {};
const vehicleParseFails = [];
const machineSamples = new Set();
const ymmSamples = new Set();

for (const p of products) {
  if (p.ridingStyle) { withRidingStyle++; ridingStyleValues[p.ridingStyle] = (ridingStyleValues[p.ridingStyle] || 0) + 1; }
  if (p.machines.size) { withMachine++; for (const m of p.machines) if (machineSamples.size < 40) machineSamples.add(m); }
  if (p.varYMM.size) { withVarYMM++; for (const m of p.varYMM) if (ymmSamples.size < 40) ymmSamples.add(m); }
  if (p.varYears.size) withVarYear++;
  if (p.vehicle) {
    withVehicle++;
    const f = normalizeFitment(p.vehicle);
    if (f.universal) parseUniversal++;
    else if (f.confident) parseConfident++;
    else { parseFail++; if (vehicleParseFails.length < 30) vehicleParseFails.push(p.vehicle); }
  }
}

const N = products.length;
const pct = (n) => `${n} (${((n / N) * 100).toFixed(1)}%)`;

console.log('===== ROW TYPES =====');
console.log(typeCounts);
console.log(`\nParsed products: ${N}\n`);

console.log('===== ATTRIBUTE COVERAGE (of products) =====');
console.log(`Has "Riding Style":           ${pct(withRidingStyle)}`);
console.log(`Has "Vehicle" attribute:      ${pct(withVehicle)}`);
console.log(`Has "Machine" variation opt:  ${pct(withMachine)}`);
console.log(`Has "Year-Make-Model" var:    ${pct(withVarYMM)}`);
console.log(`Has "Year" variation opt:     ${pct(withVarYear)}`);

const anyVehicleLevel = products.filter(p => p.vehicle || p.machines.size || p.varYMM.size).length;
console.log(`\nHas ANY vehicle-level fitment (Vehicle OR Machine OR Y-M-M): ${pct(anyVehicleLevel)}`);

console.log('\n===== "Vehicle" ATTRIBUTE PARSE RESULTS (of the ' + withVehicle + ' that have it) =====');
console.log(`Confident make+model parse:   ${parseConfident}`);
console.log(`Universal Fitment:            ${parseUniversal}`);
console.log(`Failed / low-confidence:      ${parseFail}`);

console.log('\n===== DISTINCT "Riding Style" VALUES =====');
Object.entries(ridingStyleValues).sort((a, b) => b[1] - a[1]).forEach(([v, c]) => console.log(`  ${String(c).padStart(5)}  ${v}`));

console.log('\n===== SAMPLE "Machine" VARIATION VALUES =====');
[...machineSamples].slice(0, 25).forEach(v => console.log('  ' + v));

console.log('\n===== SAMPLE "Year-Make-Model" VARIATION VALUES =====');
[...ymmSamples].slice(0, 25).forEach(v => console.log('  ' + v));

console.log('\n===== SAMPLE "Vehicle" PARSE FAILURES (need rules/cleanup) =====');
vehicleParseFails.forEach(v => console.log('  ' + JSON.stringify(v)));

// --- Untagged + category breakdown ---
const untagged = products.filter(p => !p.ridingStyle && !p.vehicle && !p.machines.size && !p.varYMM.size);
console.log(`\n===== UNTAGGED (no Riding Style, Vehicle, Machine, or Y-M-M) =====`);
console.log(pct(untagged.length));

console.log('\n===== FITMENT COVERAGE BY TOP CATEGORY =====');
const byCat = {};
for (const p of products) {
  const c = p.cat1 || '(none)';
  byCat[c] = byCat[c] || { total: 0, type: 0, vehicle: 0 };
  byCat[c].total++;
  if (p.ridingStyle) byCat[c].type++;
  if (p.vehicle || p.machines.size || p.varYMM.size) byCat[c].vehicle++;
}
Object.entries(byCat).sort((a, b) => b[1].total - a[1].total).forEach(([c, s]) => {
  const tp = ((s.type / s.total) * 100).toFixed(0);
  const vp = ((s.vehicle / s.total) * 100).toFixed(0);
  console.log(`  ${String(s.total).padStart(4)} total | type ${String(tp).padStart(3)}% | vehicle-fit ${String(vp).padStart(3)}%  |  ${c}`);
});

// --- Dump full distinct fitment values for parser design ---
const allVehicle = new Set(), allMachine = new Set();
for (const p of products) {
  if (p.vehicle) allVehicle.add(p.vehicle);
  for (const m of p.machines) allMachine.add(m);
}
fs.mkdirSync(__dirname + '/out', { recursive: true });
fs.writeFileSync(__dirname + '/out/distinct-vehicle.txt', [...allVehicle].sort().join('\n'));
fs.writeFileSync(__dirname + '/out/distinct-machine.txt', [...allMachine].sort().join('\n'));
console.log(`\nWrote ${allVehicle.size} distinct Vehicle values -> fitment/out/distinct-vehicle.txt`);
console.log(`Wrote ${allMachine.size} distinct Machine values -> fitment/out/distinct-machine.txt`);
