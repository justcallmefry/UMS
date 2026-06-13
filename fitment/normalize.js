/**
 * Fitment normalizer
 * ------------------
 * United Motorsports' Ecwid/Lightspeed catalog stores vehicle fitment as free-text
 * product attributes ("Vehicle Fitment", "Vehicle", or a "Machine" option), e.g.:
 *
 *   "Yamaha YZ250F (14-26')"
 *   "Honda TRX450R/ER (06-14)"
 *   "Honda CRF250R/450R (04-26)"
 *   "Yamaha YFZ450R"            (no years => fits all years)
 *   "Universal Fitment"
 *
 * This module turns those strings into structured records the finder can match
 * against and build Year/Make/Model dropdowns from. It is deliberately
 * conservative: when a string can't be confidently parsed it is returned with
 * `confident: false` and the raw text preserved, so a human (or the full-catalog
 * pass) can review the long tail instead of us silently guessing.
 *
 * NOTE: The make list and the slashed-model expansion heuristics are tuned to the
 * sampled strings. Re-run `normalize.test.js` and widen coverage once the full
 * catalog export is available — that's when the real long tail of formats shows up.
 */

'use strict';

// Powersports makes seen in / expected for the UMS catalog. Order matters only for
// readability; matching is done case-insensitively against the start of the string.
// Multi-word makes MUST come before any single-word prefix they share.
const KNOWN_MAKES = [
  'Arctic Cat',
  'Can-Am',
  'Sea-Doo',
  'Ski-Doo',
  'Gas Gas',
  'Yamaha',
  'Honda',
  'Kawasaki',
  'Suzuki',
  'KTM',
  'Polaris',
  'Husqvarna',
  'Husaberg',
  'Sherco',
  'Beta',
  'Kymco',
  'CFMoto',
  'Bombardier',
];

// Common spelling variants -> canonical make.
const MAKE_ALIASES = {
  canam: 'Can-Am',
  'can am': 'Can-Am',
  seadoo: 'Sea-Doo',
  'sea doo': 'Sea-Doo',
  skidoo: 'Ski-Doo',
  'ski doo': 'Ski-Doo',
  gasgas: 'Gas Gas',
  'cf moto': 'CFMoto',
  'arcticcat': 'Arctic Cat',
};

const UNIVERSAL_RE = /^\s*universal(\s+fitment)?\s*$/i;
// "(14-26')", "(06-14)", "(92-25)", "(2014-2026)", "(14-26)"; trailing apostrophe is noise.
const YEAR_RANGE_RE = /\((\d{2,4})\s*[-–]\s*(\d{2,4})'?\)/;
// "(2023)" single year.
const SINGLE_YEAR_RE = /\((\d{4}|\d{2})'?\)/;

/** Expand a 2-digit model year to 4 digits. 80-99 => 19xx, else 20xx. */
function expandYear(token) {
  const s = String(token).trim();
  if (s.length === 4) return parseInt(s, 10);
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return null;
  return n <= 29 ? 2000 + n : 1900 + n;
}

/**
 * Expand a slashed model token sharing a common prefix:
 *   "TRX450R/ER"   -> ["TRX450R", "TRX450ER"]
 *   "CRF250R/450R" -> ["CRF250R", "CRF450R"]
 *   "KX250F/450F"  -> ["KX250F", "KX450F"]
 *   "YZ/YZF"       -> ["YZ", "YZF"]
 *   "SX/SXF"       -> ["SX", "SXF"]
 *
 * Heuristic: split on "/". The first segment is the full base model. For each later
 * segment, find the longest prefix of the base that makes the result look like the
 * base (i.e. graft the suffix onto the shared leading alpha/numeric stem). When the
 * later segment already looks like a full model (shares the base's leading letters),
 * keep it as-is.
 */
function expandModelAlternates(model) {
  if (!model.includes('/')) return [model];
  const parts = model.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [model];

  const base = parts[0];
  const out = [base];
  // Leading alpha stem of the base, e.g. "TRX" from "TRX450R", "CRF" from "CRF250R",
  // "KX" from "KX250F", "YZ" from "YZ".
  const baseStem = (base.match(/^[A-Za-z]+/) || [''])[0];

  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    if (/^[A-Za-z]/.test(seg)) {
      // Segment starts with letters.
      if (/\d/.test(seg)) {
        // Has its own displacement -> a complete model (e.g. "TC85", "MC85"). Keep as-is.
        out.push(seg);
      } else if (seg.startsWith(baseStem)) {
        // Full model on its own (e.g. "YZF" vs base "YZ").
        out.push(seg);
      } else {
        // Suffix variant grafted onto the base minus its trailing letters,
        // e.g. base "TRX450R" + seg "ER" -> "TRX450" + "ER" = "TRX450ER".
        const cut = base.replace(/[A-Za-z]+$/, '');
        out.push(cut + seg);
      }
    } else {
      // Segment starts with a number (e.g. base "CRF250R" + seg "450R" -> "CRF450R"):
      // graft onto the base's leading alpha stem.
      out.push(baseStem + seg);
    }
  }
  return Array.from(new Set(out));
}

/**
 * Normalize one raw fitment string.
 * @returns {{
 *   raw: string,
 *   universal: boolean,
 *   make: string|null,
 *   models: string[],
 *   yearStart: number|null,
 *   yearEnd: number|null,
 *   allYears: boolean,
 *   confident: boolean
 * }}
 */
function normalizeFitment(raw) {
  const base = {
    raw: raw == null ? '' : String(raw),
    universal: false,
    make: null,
    models: [],
    yearStart: null,
    yearEnd: null,
    allYears: false,
    confident: false,
  };

  const text = base.raw.trim();
  if (!text) return base;

  if (UNIVERSAL_RE.test(text)) {
    return { ...base, universal: true, allYears: true, confident: true };
  }

  // --- Years ---
  let yearStart = null;
  let yearEnd = null;
  let allYears = false;
  const range = text.match(YEAR_RANGE_RE);
  if (range) {
    yearStart = expandYear(range[1]);
    yearEnd = expandYear(range[2]);
    if (yearStart != null && yearEnd != null && yearStart > yearEnd) {
      [yearStart, yearEnd] = [yearEnd, yearStart];
    }
  } else {
    const single = text.match(SINGLE_YEAR_RE);
    if (single) {
      yearStart = yearEnd = expandYear(single[1]);
    }
  }

  // Strip the year parenthetical and a trailing "all" marker to leave make + model.
  let body = text
    .replace(YEAR_RANGE_RE, '')
    .replace(SINGLE_YEAR_RE, '')
    .replace(/\ball\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (yearStart == null) allYears = true; // no explicit years => fits all years

  // --- Make ---
  let make = null;
  const lowerBody = body.toLowerCase();
  for (const candidate of KNOWN_MAKES) {
    if (lowerBody.startsWith(candidate.toLowerCase())) {
      make = candidate;
      body = body.slice(candidate.length).trim();
      break;
    }
  }
  if (!make) {
    // Try aliases (normalize spacing) against the leading token(s).
    for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
      if (lowerBody.startsWith(alias)) {
        make = canonical;
        body = body.slice(alias.length).trim();
        break;
      }
    }
  }

  // --- Models ---
  const models = body ? expandModelAlternates(body) : [];

  const confident = Boolean(make) && (models.length > 0);

  return {
    raw: base.raw,
    universal: false,
    make,
    models,
    yearStart,
    yearEnd,
    allYears,
    confident,
  };
}

/**
 * Does a normalized fitment record cover a concrete vehicle selection?
 * @param {object} fit  result of normalizeFitment
 * @param {{make:string, model:string, year:number}} vehicle
 */
function fitsVehicle(fit, vehicle) {
  if (!fit) return false;
  if (fit.universal) return true;
  if (!vehicle) return false;

  if (fit.make && vehicle.make && fit.make.toLowerCase() !== vehicle.make.toLowerCase()) {
    return false;
  }
  if (fit.models.length && vehicle.model) {
    const wanted = vehicle.model.toLowerCase();
    const ok = fit.models.some((m) => m.toLowerCase() === wanted);
    if (!ok) return false;
  }
  if (!fit.allYears && vehicle.year != null) {
    if (fit.yearStart != null && vehicle.year < fit.yearStart) return false;
    if (fit.yearEnd != null && vehicle.year > fit.yearEnd) return false;
  }
  return true;
}

module.exports = {
  KNOWN_MAKES,
  expandYear,
  expandModelAlternates,
  normalizeFitment,
  fitsVehicle,
};
