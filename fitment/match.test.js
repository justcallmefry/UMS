'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFitment } = require('./parse');
const { matchProducts, fitCount } = require('./match');

// Build a tiny index the way build-data does (clauses come from parseFitment).
function entry(sku, types, fitStr, universal) {
  const p = fitStr ? parseFitment(fitStr) : { universal: !!universal, clauses: [] };
  return { sku, name: sku, types, universal: !!universal || p.universal, clauses: p.clauses };
}
const index = [
  entry('A', ['Dirtbike'], "Yamaha YZ250F (14-26')"),          // exact for YZ250F 2014-2026
  entry('B', ['Dirtbike'], "Honda CRF250R/450R (02-25')"),     // exact for CRF250R/450R
  entry('C', ['Dirtbike'], null),                               // type-only dirtbike
  entry('D', [], 'Universal Fitment'),                          // universal
  entry('E', ['ATV'], "Honda TRX450R/ER (06-14')"),            // exact ATV, different type
];

test('exact match on make+model+year', () => {
  const r = matchProducts({ type: 'Dirtbike', year: 2020, make: 'Yamaha', model: 'YZ250F' }, index);
  assert.deepEqual(r.exact.map((p) => p.sku), ['A']);
  assert.deepEqual(r.universal.map((p) => p.sku), ['D']);
  assert.deepEqual(r.typeMatch.map((p) => p.sku), ['C']); // dirtbike type-only
});

test('year outside range drops the exact match', () => {
  const r = matchProducts({ type: 'Dirtbike', year: 2010, make: 'Yamaha', model: 'YZ250F' }, index);
  assert.equal(r.exact.length, 0);
});

test('slashed model matches either expansion', () => {
  const r = matchProducts({ type: 'Dirtbike', year: 2018, make: 'Honda', model: 'CRF450R' }, index);
  assert.ok(r.exact.some((p) => p.sku === 'B'));
});

test('ATV part does not exact-match a dirtbike pick', () => {
  const r = matchProducts({ type: 'Dirtbike', year: 2010, make: 'Honda', model: 'CRF450R' }, index);
  assert.ok(!r.exact.some((p) => p.sku === 'E'));
});

test('fitCount returns the exact bucket size', () => {
  assert.equal(fitCount({ type: 'Dirtbike', year: 2020, make: 'Yamaha', model: 'YZ250F' }, index), 1);
});
