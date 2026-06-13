'use strict';
/** Tests for the multi-clause parser, using real strings from the catalog export. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFitment, fitsVehicle, expandToVehicles, extractYears } = require('./parse');

test('extractYears: suffix range with apostrophe', () => {
  const r = extractYears("YZ250F (14-26')");
  assert.equal(r.yearStart, 2014); assert.equal(r.yearEnd, 2026);
});
test('extractYears: open-ended Up and +', () => {
  assert.equal(extractYears('(2020-Up)').yearEnd, null);
  assert.equal(extractYears('(2020-Up)').yearStart, 2020);
  assert.equal(extractYears('2022+').yearEnd, null);
});
test('extractYears: prefix year', () => {
  const r = extractYears('2025 Polaris Ranger 1000');
  assert.equal(r.yearStart, 2025); assert.equal(r.yearEnd, 2025);
  assert.match(r.cleaned, /Polaris Ranger 1000/);
});

test('single clean clause', () => {
  const p = parseFitment("Yamaha YZ250F (14-26')");
  assert.equal(p.clauses.length, 1);
  assert.equal(p.clauses[0].make, 'Yamaha');
  assert.deepEqual(p.clauses[0].models, ['YZ250F']);
  assert.equal(p.clauses[0].yearStart, 2014);
  assert.equal(p.clauses[0].yearEnd, 2026);
  assert.equal(p.confident, true);
});

test('multi-group with per-group years, make inherited', () => {
  const p = parseFitment("Honda CRF250R (10-13') / CRF450R (09-14')");
  assert.equal(p.clauses.length, 2);
  assert.equal(p.clauses[0].make, 'Honda');
  assert.deepEqual(p.clauses[0].models, ['CRF250R']);
  assert.equal(p.clauses[1].make, 'Honda');
  assert.deepEqual(p.clauses[1].models, ['CRF450R']);
  assert.equal(p.clauses[1].yearStart, 2009);
});

test('model family with no-space slash stays one group, expands', () => {
  const p = parseFitment("Honda CRF250R/450R (02-25')");
  assert.equal(p.clauses.length, 1);
  assert.deepEqual(p.clauses[0].models, ['CRF250R', 'CRF450R']);
});

test('cross-make groups', () => {
  const p = parseFitment("Honda CRF250R/450R (02-25') / Suzuki RMZ250/RMZ450 (05-25')");
  assert.equal(p.clauses.length, 2);
  assert.equal(p.clauses[0].make, 'Honda');
  assert.equal(p.clauses[1].make, 'Suzuki');
  assert.deepEqual(p.clauses[1].models, ['RMZ250', 'RMZ450']);
});

test('comma-separated models inherit make', () => {
  const p = parseFitment('Kawasaki KX250, KX450, KLX450, KX500');
  assert.equal(p.clauses.length, 4);
  assert.ok(p.clauses.every((c) => c.make === 'Kawasaki'));
  assert.deepEqual(p.clauses.map((c) => c.models[0]), ['KX250', 'KX450', 'KLX450', 'KX500']);
});

test('make-level "Models" entry', () => {
  const p = parseFitment('Can-Am Models');
  assert.equal(p.clauses.length, 1);
  assert.equal(p.clauses[0].make, 'Can-Am');
  assert.equal(p.clauses[0].makeLevel, true);
  assert.equal(p.confident, true);
});

test('year-prefix vehicle', () => {
  const p = parseFitment('2025 Polaris Ranger 1000');
  assert.equal(p.clauses[0].make, 'Polaris');
  assert.equal(p.clauses[0].yearStart, 2025);
  assert.ok(p.clauses[0].models[0].includes('Ranger'));
});

test('open-ended prefix "2024-Up"', () => {
  const p = parseFitment('2024-Up Polaris RZR XP 1000');
  assert.equal(p.clauses[0].make, 'Polaris');
  assert.equal(p.clauses[0].yearStart, 2024);
  assert.equal(p.clauses[0].yearEnd, null);
});

test('multi-make make-level', () => {
  const p = parseFitment('KTM / GasGas / Husqvarna MX & XC Bikes');
  assert.equal(p.clauses.length, 3);
  assert.deepEqual(p.clauses.map((c) => c.make), ['KTM', 'GasGas', 'Husqvarna']);
  assert.ok(p.clauses.every((c) => c.makeLevel));
});

test('word model (no digits) is NOT make-level', () => {
  const p = parseFitment("Yamaha Banshee (87-06')");
  assert.equal(p.clauses[0].makeLevel, false);
  assert.deepEqual(p.clauses[0].models, ['Banshee']);
});

test('comma inside parens is not split', () => {
  const p = parseFitment("Honda TRX250X (87-88, 91-92')");
  assert.equal(p.clauses.length, 1);
  assert.equal(p.clauses[0].make, 'Honda');
});

test('fitsVehicle: in range', () => {
  const p = parseFitment("Yamaha YZ250F (14-26')");
  assert.equal(fitsVehicle(p, { make: 'Yamaha', model: 'YZ250F', year: 2019 }), true);
  assert.equal(fitsVehicle(p, { make: 'Yamaha', model: 'YZ250F', year: 2013 }), false);
});
test('fitsVehicle: open-ended end matches future years', () => {
  const p = parseFitment('2024-Up Polaris RZR XP 1000');
  assert.equal(fitsVehicle(p, { make: 'Polaris', model: 'RZR XP 1000', year: 2030 }), true);
  assert.equal(fitsVehicle(p, { make: 'Polaris', model: 'RZR XP 1000', year: 2023 }), false);
});
test('fitsVehicle: make-level matches any model of make', () => {
  const p = parseFitment('Can-Am Models');
  assert.equal(fitsVehicle(p, { make: 'Can-Am', model: 'Maverick X3', year: 2022 }), true);
  assert.equal(fitsVehicle(p, { make: 'Polaris', model: 'RZR', year: 2022 }), false);
});

test('expandToVehicles: range explodes to discrete years', () => {
  const p = parseFitment("Yamaha YZ250F (14-16')");
  const v = expandToVehicles(p);
  assert.deepEqual(v.map((x) => x.year), [2014, 2015, 2016]);
  assert.ok(v.every((x) => x.make === 'Yamaha' && x.model === 'YZ250F'));
});
