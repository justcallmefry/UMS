'use strict';
/**
 * Tests for the fitment normalizer, using the REAL fitment strings observed on
 * unitedmotorsports.com product pages (2026-06). Run: `node --test fitment/`.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  expandYear,
  expandModelAlternates,
  normalizeFitment,
  fitsVehicle,
} = require('./normalize');

test('expandYear: 2-digit century inference', () => {
  assert.equal(expandYear('14'), 2014);
  assert.equal(expandYear('26'), 2026);
  assert.equal(expandYear('06'), 2006);
  assert.equal(expandYear('92'), 1992);
  assert.equal(expandYear('99'), 1999);
  assert.equal(expandYear('00'), 2000);
  assert.equal(expandYear('2023'), 2023);
});

test('expandModelAlternates: shared-suffix variants', () => {
  assert.deepEqual(expandModelAlternates('TRX450R/ER'), ['TRX450R', 'TRX450ER']);
  assert.deepEqual(expandModelAlternates('YZ/YZF'), ['YZ', 'YZF']);
  assert.deepEqual(expandModelAlternates('SX/SXF'), ['SX', 'SXF']);
});

test('expandModelAlternates: shared-prefix numeric variants', () => {
  assert.deepEqual(expandModelAlternates('CRF250R/450R'), ['CRF250R', 'CRF450R']);
  assert.deepEqual(expandModelAlternates('KX250F/450F'), ['KX250F', 'KX450F']);
});

test('expandModelAlternates: no slash is a passthrough', () => {
  assert.deepEqual(expandModelAlternates('YZ250F'), ['YZ250F']);
  assert.deepEqual(expandModelAlternates('Raptor 700'), ['Raptor 700']);
});

test('normalize: make + model + year range', () => {
  const f = normalizeFitment("Yamaha YZ250F (14-26')");
  assert.equal(f.make, 'Yamaha');
  assert.deepEqual(f.models, ['YZ250F']);
  assert.equal(f.yearStart, 2014);
  assert.equal(f.yearEnd, 2026);
  assert.equal(f.allYears, false);
  assert.equal(f.confident, true);
});

test('normalize: slashed model + year range', () => {
  const f = normalizeFitment('Honda TRX450R/ER (06-14)');
  assert.equal(f.make, 'Honda');
  assert.deepEqual(f.models, ['TRX450R', 'TRX450ER']);
  assert.equal(f.yearStart, 2006);
  assert.equal(f.yearEnd, 2014);
  assert.equal(f.confident, true);
});

test('normalize: numeric-variant slashed model', () => {
  const f = normalizeFitment('Honda CRF250R/450R (04-26)');
  assert.equal(f.make, 'Honda');
  assert.deepEqual(f.models, ['CRF250R', 'CRF450R']);
  assert.equal(f.yearStart, 2004);
  assert.equal(f.yearEnd, 2026);
});

test('normalize: 1990s start year', () => {
  const f = normalizeFitment('Yamaha YZ/YZF (92-25)');
  assert.equal(f.make, 'Yamaha');
  assert.deepEqual(f.models, ['YZ', 'YZF']);
  assert.equal(f.yearStart, 1992);
  assert.equal(f.yearEnd, 2025);
});

test('normalize: no years means all years', () => {
  const f = normalizeFitment('Yamaha YFZ450R');
  assert.equal(f.make, 'Yamaha');
  assert.deepEqual(f.models, ['YFZ450R']);
  assert.equal(f.allYears, true);
  assert.equal(f.yearStart, null);
  assert.equal(f.confident, true);
});

test('normalize: multi-word model', () => {
  const f = normalizeFitment('Yamaha Raptor 700');
  assert.equal(f.make, 'Yamaha');
  assert.deepEqual(f.models, ['Raptor 700']);
});

test('normalize: universal fitment', () => {
  const f = normalizeFitment('Universal Fitment');
  assert.equal(f.universal, true);
  assert.equal(f.allYears, true);
  assert.equal(f.confident, true);
});

test('normalize: unparseable string is not confident', () => {
  const f = normalizeFitment('see description for fitment');
  assert.equal(f.confident, false);
  assert.equal(f.make, null);
});

test('normalize: empty / null', () => {
  assert.equal(normalizeFitment('').confident, false);
  assert.equal(normalizeFitment(null).confident, false);
});

test('fitsVehicle: year inside range matches', () => {
  const f = normalizeFitment("Yamaha YZ250F (14-26')");
  assert.equal(fitsVehicle(f, { make: 'Yamaha', model: 'YZ250F', year: 2019 }), true);
  assert.equal(fitsVehicle(f, { make: 'Yamaha', model: 'YZ250F', year: 2013 }), false);
  assert.equal(fitsVehicle(f, { make: 'Yamaha', model: 'YZ250F', year: 2027 }), false);
});

test('fitsVehicle: slashed model matches either expansion', () => {
  const f = normalizeFitment('Honda TRX450R/ER (06-14)');
  assert.equal(fitsVehicle(f, { make: 'Honda', model: 'TRX450ER', year: 2010 }), true);
  assert.equal(fitsVehicle(f, { make: 'Honda', model: 'TRX450R', year: 2010 }), true);
  assert.equal(fitsVehicle(f, { make: 'Honda', model: 'CRF450R', year: 2010 }), false);
});

test('fitsVehicle: universal fits anything', () => {
  const f = normalizeFitment('Universal Fitment');
  assert.equal(fitsVehicle(f, { make: 'Polaris', model: 'RZR 1000', year: 2024 }), true);
});

test('fitsVehicle: all-years ignores year', () => {
  const f = normalizeFitment('Yamaha YFZ450R');
  assert.equal(fitsVehicle(f, { make: 'Yamaha', model: 'YFZ450R', year: 2008 }), true);
  assert.equal(fitsVehicle(f, { make: 'Yamaha', model: 'YFZ450R', year: 2024 }), true);
});

test('fitsVehicle: wrong make never matches', () => {
  const f = normalizeFitment("Yamaha YZ250F (14-26')");
  assert.equal(fitsVehicle(f, { make: 'Honda', model: 'YZ250F', year: 2019 }), false);
});
