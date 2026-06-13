'use strict';
/**
 * Robust multi-clause fitment parser for the UMS catalog.
 *
 * Real `Vehicle` / `Machine` strings are human-written and pack several vehicles
 * into one field, e.g.:
 *   "Honda CRF250R (10-13') / CRF450R (09-14')"
 *   "Yamaha YZ250F (14-26')"
 *   "2024-Up Polaris RZR XP 1000"
 *   "KTM / GasGas / Husqvarna MX & XC Bikes"
 *   "Can-Am Models"
 *   "Universal Fitment"
 *
 * parseFitment() returns a list of CLAUSES, each a {make, models[], yearStart,
 * yearEnd, makeLevel} record. A clause with makeLevel:true fits *any* model of
 * that make (the catalog's "...Models"/"...Machines" entries). yearEnd:null means
 * open-ended ("-Up"/"+"). Designed for matching breadth over perfect structure —
 * the messy typo tail still yields make + a year window so it matches sensibly.
 *
 * Splitting rule (data-backed): vehicle GROUPS are separated by " / " (slash with
 * surrounding spaces) or ", "; model FAMILIES use "/" with no spaces (CRF250R/450R).
 */

const { expandModelAlternates, KNOWN_MAKES: BASE_MAKES } = require('./normalize');

const CURRENT_YEAR = 2026;

const KNOWN_MAKES = [
  'Arctic Cat', 'Can-Am', 'Sea-Doo', 'Ski-Doo', 'Gas Gas', 'GasGas',
  'Harley Davidson', 'Harley-Davidson', 'CF Moto', 'CR Moto', 'CFMoto', 'CFMOTO',
  'Husqvarna', 'Husaberg', 'Triumph', 'BMW',
  'Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'KTM', 'Polaris', 'Sherco', 'Beta', 'Kymco',
];

const MAKE_CANONICAL = {
  gasgas: 'GasGas', 'gas gas': 'GasGas',
  'cf moto': 'CFMoto', 'cr moto': 'CFMoto', cfmoto: 'CFMoto',
  'harley-davidson': 'Harley Davidson', 'harley davidson': 'Harley Davidson',
  'can-am': 'Can-Am', 'arctic cat': 'Arctic Cat',
};

// Words that, once the make and years are removed, signal a make-level ("all models")
// fitment rather than a specific model.
const GENERIC = new Set([
  'models', 'model', 'machines', 'machine', 'applications', 'application',
  'bikes', 'bike', 'dirtbikes', 'dirtbike', 'most', 'sport', 'utv', 'atv',
  'mx', 'xc', 'and', 'larger', 'years', 'up', 'cc', 'big',
]);

const canonMake = (m) => MAKE_CANONICAL[m.toLowerCase()] || m;

/** Canonical make if `s` is (or starts with) a known vehicle make, else null. */
function toKnownMake(s) {
  if (!s) return null;
  const lower = String(s).trim().toLowerCase();
  for (const make of KNOWN_MAKES) if (lower === make.toLowerCase() || lower.startsWith(make.toLowerCase() + ' ')) return canonMake(make);
  return null;
}

/** 2-digit year -> 4-digit (>=80 => 1900s, else 2000s). */
function expandYear(tok) {
  const s = String(tok).replace(/['’]/g, '').trim();
  if (/^\d{4}$/.test(s)) return parseInt(s, 10);
  // 2-digit: model years 00-29 => 2000s; 30-99 => 1900s (no powersports "2076").
  if (/^\d{2}$/.test(s)) { const n = parseInt(s, 10); return n <= 29 ? 2000 + n : 1900 + n; }
  return null;
}

/**
 * Pull a year window out of a group string (prefix or suffix, parens optional,
 * apostrophes ignored, open-ended via Up/Current/+). Returns the years and the
 * string with the year text removed.
 */
function extractYears(str) {
  let yearStart = null, yearEnd = null, found = false, m;

  // Detect the FIRST year window for the record (range / open-ended / single / prefix).
  const rangeRe = /(\d{4}|\d{2})\s*['’]?\s*[-–]\s*(\d{2,4}|up|current)\s*['’]?/i;
  const plusRe = /(\d{4}|\d{2})\s*['’]?\s*\+/;
  const singleParenRe = /\((\d{4}|\d{2})\s*['’]?\)/;
  const prefixYearRe = /^\s*(\d{4})\b/;
  if ((m = str.match(rangeRe))) {
    yearStart = expandYear(m[1]);
    const end = m[2];
    yearEnd = /up|current/i.test(end) ? null : expandYear(end);
    if (yearStart != null && yearEnd != null && yearStart > yearEnd) [yearStart, yearEnd] = [yearEnd, yearStart];
    found = true;
  } else if ((m = str.match(plusRe))) { yearStart = expandYear(m[1]); yearEnd = null; found = true; }
  else if ((m = str.match(singleParenRe))) { yearStart = yearEnd = expandYear(m[1]); found = true; }
  else if ((m = str.match(prefixYearRe))) { yearStart = yearEnd = expandYear(m[1]); found = true; }

  // Build the model text: drop ALL parentheticals (years live there, incl. comma lists
  // like "(87-88, 91-92')"), plus prefix/suffix year ranges that aren't parenthesised.
  const cleaned = str
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*\d{4}\s*[-–]?\s*(up|current)?\s+/i, ' ')
    .replace(/^\s*\d{2}\s*['’]?\s*[-–]\s*(\d{2,4}|up|current)\s*['’]?\s+/i, ' ')
    .replace(/\s+\d{2,4}\s*['’]?\s*[-–]\s*(\d{2,4}|up|current)\s*['’]?\s*$/i, ' ')
    .replace(/\s+(\d{2}|\d{4})\s*['’]?\s*\+\s*$/, ' ')
    .replace(/[-–]\s*(up|current)\b/ig, ' ')
    .replace(/['’]/g, ' ')
    .replace(/\s*[-–]\s*$/, ' ')
    .replace(/\s+/g, ' ').trim();

  return { yearStart, yearEnd, allYears: !found, cleaned };
}

/** Split a fitment string into top-level groups on " / " or ", ", but never inside parens. */
function splitGroups(text) {
  const groups = [];
  let depth = 0, buf = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    if (depth === 0) {
      // Slash group separator when a space sits on EITHER side ("A / B", "570/ Sportsman").
      // A bare "/" with no surrounding space is a model family (CRF250R/450R) — keep it.
      if (c === '/' && (text[i - 1] === ' ' || text[i + 1] === ' ')) { groups.push(buf.trim()); buf = ''; continue; }
      // ", " group separator
      if (c === ',' && text[i + 1] === ' ') { groups.push(buf.trim()); buf = ''; continue; }
    }
    buf += c;
  }
  if (buf.trim()) groups.push(buf.trim());
  return groups.filter(Boolean);
}

function leadingMake(str) {
  const lower = str.toLowerCase();
  for (const make of KNOWN_MAKES) {
    if (lower.startsWith(make.toLowerCase())) {
      return { make: canonMake(make), rest: str.slice(make.length).trim() };
    }
  }
  return { make: null, rest: str };
}

/** Clean a remainder into model(s); detect make-level. */
function modelsFromRemainder(rest) {
  let r = rest.replace(/[()'’]/g, ' ').replace(/&/g, ' ').replace(/\s+/g, ' ').trim();
  r = r.replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
  if (!r) return { models: [], makeLevel: true };

  // If, after dropping generic words, nothing model-like remains, it's make-level.
  const tokens = r.split(/\s+/);
  const meaningful = tokens.filter((t) => !GENERIC.has(t.toLowerCase()) && !/^\d{2,4}$/.test(t.replace(/['’]/g, '')));
  if (meaningful.length === 0) return { models: [], makeLevel: true };

  // Trim trailing generic descriptors ("... Models", "... Bikes", "... Machines").
  while (tokens.length && GENERIC.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();
  const model = tokens.join(' ').trim();
  if (!model) return { models: [], makeLevel: true };

  // Expand a no-space slash family (CRF250R/450R), else single model.
  const models = /\S\/\S/.test(model) ? expandModelAlternates(model) : [model];
  return { models, makeLevel: false };
}

/**
 * @returns {{ raw:string, universal:boolean, clauses:Array<{make:string|null, models:string[], yearStart:number|null, yearEnd:number|null, makeLevel:boolean}>, confident:boolean }}
 */
function parseFitment(raw, opts = {}) {
  const text = (raw == null ? '' : String(raw)).trim();
  if (!text) return { raw: text, universal: false, clauses: [], confident: false };
  if (/^universal/i.test(text)) return { raw: text, universal: true, clauses: [], confident: true };

  const defaultMake = opts.defaultMake ? canonMake(opts.defaultMake) : null;
  const groups = splitGroups(text);
  const clauses = [];
  let lastMake = null;
  for (const g of groups) {
    const { yearStart, yearEnd, allYears, cleaned } = extractYears(g);
    let { make, rest } = leadingMake(cleaned);
    if (make) lastMake = make; else make = lastMake || defaultMake; // inherit make, else product brand
    const { models, makeLevel } = modelsFromRemainder(rest);
    clauses.push({
      make: make || null,
      models,
      yearStart: allYears ? null : yearStart,
      yearEnd: allYears ? null : yearEnd,
      makeLevel: makeLevel || models.length === 0,
    });
  }
  const confident = clauses.some((c) => c.make && (c.models.length > 0 || c.makeLevel));
  return { raw: text, universal: false, clauses, confident };
}

/** Does a parsed fitment cover a concrete {make, model, year}? */
function fitsVehicle(parsed, vehicle) {
  if (!parsed) return false;
  if (parsed.universal) return true;
  if (!vehicle) return false;
  const vMake = (vehicle.make || '').toLowerCase();
  const vModel = (vehicle.model || '').toLowerCase();
  return parsed.clauses.some((c) => {
    if (c.make && vMake && c.make.toLowerCase() !== vMake) return false;
    if (!c.makeLevel && c.models.length && vModel) {
      if (!c.models.some((m) => m.toLowerCase() === vModel)) return false;
    }
    if (vehicle.year != null) {
      if (c.yearStart != null && vehicle.year < c.yearStart) return false;
      if (c.yearEnd != null && vehicle.year > c.yearEnd) return false;
    }
    return true;
  });
}

/** Expand a parsed fitment into discrete {make, model, year} tuples for dropdown building. */
function expandToVehicles(parsed, capYear = CURRENT_YEAR) {
  if (!parsed || parsed.universal) return [];
  const out = [];
  for (const c of parsed.clauses) {
    if (c.makeLevel || !c.make || !c.models.length) continue;
    const start = c.yearStart;
    const end = c.yearEnd == null ? (start != null ? capYear : null) : c.yearEnd;
    for (const model of c.models) {
      if (start != null && end != null) {
        for (let y = start; y <= Math.min(end, capYear + 1); y++) out.push({ make: c.make, model, year: y });
      } else {
        out.push({ make: c.make, model, year: null });
      }
    }
  }
  return out;
}

module.exports = { parseFitment, fitsVehicle, expandToVehicles, extractYears, splitGroups, expandYear, toKnownMake, KNOWN_MAKES, CURRENT_YEAR };
