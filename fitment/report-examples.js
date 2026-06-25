'use strict';
/**
 * Generate a shareable "what fields the filter reads + real examples" report from a
 * catalog CSV, so the catalog owner can target cleanup.
 *   node fitment/report-examples.js "<csv>"
 */
const fs = require('fs');
const { parseFitment, toKnownMake } = require('./parse');

const csvPath = process.argv[2];
if (!csvPath) { console.error('Usage: node fitment/report-examples.js "<csv>"'); process.exit(1); }

function parseCsv(text){const rows=[];let row=[],f='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);f='';rows.push(row);row=[];}else if(c==='\r'){}else f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}

const rows = parseCsv(fs.readFileSync(csvPath,'utf8'));
const h = rows[0], idx = {}; h.forEach((c,i)=>idx[c]=i);
const col=(r,n)=>{const i=idx[n];return i==null?'':(r[i]||'').trim();};
const C={type:'type',sku:'product_sku',name:'product_name',brand:'product_brand',
  rs:'product_attribute_{Riding Style}',veh:'product_attribute_Vehicle',cat:'product_category_1',
  machine:'product_variation_option_Machine'};

const products=[];let cur=null;
for(let r=1;r<rows.length;r++){const row=rows[r];const t=col(row,C.type);
  if(t==='product'){cur={sku:col(row,C.sku),name:col(row,C.name).replace(/\s+/g,' ').trim(),brand:col(row,C.brand),
    rs:col(row,C.rs),veh:col(row,C.veh),cat:col(row,C.cat),machines:new Set()};
    const m=col(row,C.machine);if(m)cur.machines.add(m);products.push(cur);}
  else if(cur){const m=col(row,C.machine);if(m)cur.machines.add(m);}}

function classify(p){
  if(!p.veh) return p.machines.size?'machineOnly':(p.rs?'typeOnly':'missing');
  const parsed=parseFitment(p.veh,{defaultMake:toKnownMake(p.brand)});
  if(parsed.universal) return 'universal';
  if(parsed.clauses.some(c=>!c.makeLevel&&c.models.length)) return 'precise';
  if(parsed.clauses.length) return 'broad';
  return 'unparseable';
}
const buckets={precise:[],broad:[],typeOnly:[],machineOnly:[],universal:[],unparseable:[],missing:[]};
for(const p of products) buckets[classify(p)].push(p);

const N=products.length, pct=n=>((n/N)*100).toFixed(0)+'%';
console.log('==== FIELDS THE FILTER READS (Ecwid/Lightspeed product Attributes) ====');
console.log('  • "Riding Style"  -> machine TYPE (Dirtbike / ATV / UTV / Street / ADV-Dualsport / Cruiser)');
console.log('  • "Vehicle"       -> specific MAKE + MODEL + YEARS, e.g. "KTM SX65 (1998-2010)"');
console.log('  • (minor) "Machine" variation option on a few products\n');

console.log('==== CATALOG BREAKDOWN ('+N+' products) ====');
console.log('  Precise vehicle tag (best):   '+buckets.precise.length+'  ('+pct(buckets.precise.length)+')');
console.log('  Broad/brand-only vehicle tag: '+buckets.broad.length+'  ('+pct(buckets.broad.length)+')   <- tighten these');
console.log('  Type only (no Vehicle):       '+buckets.typeOnly.length+'  ('+pct(buckets.typeOnly.length)+')');
console.log('  Universal:                    '+buckets.universal.length);
console.log('  Machine-option only:          '+buckets.machineOnly.length);
console.log('  Unparseable vehicle tag:      '+buckets.unparseable.length);
console.log('  NO fitment at all (missing):  '+buckets.missing.length+'  ('+pct(buckets.missing.length)+')   <- biggest gap\n');

function show(list,n,fields){list.slice(0,n).forEach(p=>console.log('   • ['+p.sku+'] '+p.name.slice(0,52)+fields(p)));}

console.log('==== GOOD EXAMPLES — precise "Vehicle" tags (do more of this) ====');
show(buckets.precise,8,p=>'\n        Vehicle = "'+p.veh+'"');

console.log('\n==== BROAD EXAMPLES — brand-only, no model/year (tighten to a model+year) ====');
show(buckets.broad,8,p=>'\n        Vehicle = "'+p.veh+'"');

console.log('\n==== MISSING EXAMPLES — no Riding Style, no Vehicle (mostly OEM parts) ====');
show(buckets.missing,12,p=>'   ['+(p.cat||'(no category)')+']');

// Missing, by category, to show where to focus
const byCat={};buckets.missing.forEach(p=>{const c=p.cat||'(none)';byCat[c]=(byCat[c]||0)+1;});
console.log('\n==== WHERE THE MISSING ONES LIVE (top categories) ====');
Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([c,n])=>console.log('   '+String(n).padStart(4)+'  '+c));
