'use strict';
/**
 * Matching engine — given a selected vehicle and the fitment index, return the
 * products that fit, bucketed by confidence:
 *   - exact:     a vehicle-specific clause matches make+model(+year)
 *   - typeMatch: no specific clause, but the product's Riding Style covers the
 *                vehicle's type (e.g. a "Dirtbike" chain lube fits any dirt bike)
 *   - universal: fits everything (oil, apparel, whip lights)
 *
 * The finder shows `exact` first (the real "N parts fit" headline), then optionally
 * type/universal items as "also fits your machine". Mirrors how RMATV ranks results.
 */
const { fitsVehicle } = require('./parse');

/** @param {{type,year,make,model}} vehicle  @param {Array} index  product index entries */
function matchProducts(vehicle, index) {
  const exact = [], typeMatch = [], universal = [];
  const vType = vehicle.type;
  for (const p of index) {
    // A product with specific fitment clauses is exact-or-nothing: if none of its
    // clauses cover this vehicle, it's specific to OTHER machines, not a fit here.
    if (p.clauses && p.clauses.length) {
      if (fitsVehicle({ universal: false, clauses: p.clauses }, vehicle)) exact.push(p);
      continue;
    }
    if (p.universal) { universal.push(p); continue; }
    // Clause-less, type-only product (e.g. "Dirtbike" chain lube) fits any vehicle of its type.
    if (vType && p.types && p.types.includes(vType)) { typeMatch.push(p); continue; }
  }
  return { exact, typeMatch, universal };
}

/** Headline count = products that specifically fit this machine. */
function fitCount(vehicle, index) {
  return matchProducts(vehicle, index).exact.length;
}

module.exports = { matchProducts, fitCount };
