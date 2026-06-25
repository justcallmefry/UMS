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

/**
 * @param {{type,year,make,model}} vehicle  @param {Array} index  product index entries
 * Buckets, strongest first:
 *  - exact:     a SPECIFIC clause (real model + year window) covers this machine
 *  - broadMake: only a make-level clause matches (catalog tagged it "fits all <make>"),
 *               so it likely fits but the listing isn't model-specific
 *  - typeMatch: clause-less, fits the vehicle's riding type
 *  - universal: fits everything
 */
function matchProducts(vehicle, index) {
  const exact = [], broadMake = [], typeMatch = [], universal = [];
  const vType = vehicle.type;
  for (const p of index) {
    if (p.clauses && p.clauses.length) {
      // Specific = a non-make-level clause (has a real model) that covers the vehicle.
      const specific = p.clauses.some(
        (c) => !c.makeLevel && c.models && c.models.length && fitsVehicle({ universal: false, clauses: [c] }, vehicle)
      );
      if (specific) { exact.push(p); continue; }
      // Otherwise, does a make-level clause cover it? (e.g. "KTM Models", no model/year)
      const broad = p.clauses.some(
        (c) => c.makeLevel && fitsVehicle({ universal: false, clauses: [c] }, vehicle)
      );
      if (broad) { broadMake.push(p); continue; }
      continue; // specific to other machines
    }
    if (p.universal) { universal.push(p); continue; }
    if (vType && p.types && p.types.includes(vType)) { typeMatch.push(p); continue; }
  }
  return { exact, broadMake, typeMatch, universal };
}

/** Headline count = products that SPECIFICALLY fit this machine (model + year). */
function fitCount(vehicle, index) {
  return matchProducts(vehicle, index).exact.length;
}

module.exports = { matchProducts, fitCount };
