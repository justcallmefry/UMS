'use strict';
/**
 * One-command refresh for the live Find Parts finder.
 *
 *   node refresh-finder.js "C:\path\to\catalog_export.csv"
 *
 * Steps: rebuild the vehicle registry + fitment index from a fresh Ecwid/Lightspeed
 * CSV export, copy them into docs/finder/, then commit and push. GitHub Pages
 * rebuilds within ~1 minute and the live finder updates automatically — no Ecwid
 * change needed.
 *
 * Run it from the repo root (the UMS folder).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const csv = process.argv[2];
if (!csv) {
  console.error('Usage: node refresh-finder.js "<path-to-catalog-export.csv>"');
  process.exit(1);
}
if (!fs.existsSync(csv)) {
  console.error('CSV not found: ' + csv);
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

console.log('\n[1/3] Building fitment data from export...');
run(`node fitment/build-data.js "${csv}"`);

console.log('\n[2/3] Copying data into docs/finder/ (what the live site loads)...');
for (const f of ['vehicles.json', 'fitment-index.json']) {
  fs.copyFileSync(path.join('data', 'ums', f), path.join('docs', 'finder', f));
}

console.log('\n[3/3] Committing and pushing...');
try {
  run('git add data/ums/vehicles.json data/ums/fitment-index.json data/ums/coverage.json docs/finder/vehicles.json docs/finder/fitment-index.json');
  const stamp = new Date().toISOString().slice(0, 10);
  run(`git commit -m "Refresh finder data from catalog export (${stamp})"`);
  run('git push origin main');
  console.log('\nDone. GitHub Pages rebuilds in ~1 min — the live finder will show the new parts automatically.');
} catch (e) {
  console.log('\nNothing to commit (data unchanged) or push failed. Details:', e.message);
}
