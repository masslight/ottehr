// Vitals: unit recognition, conversion, plausibility, and recovery of a reading the model dropped.
//
// THIS IS THE SINGLE HIGHEST-RISK PIECE OF ARITHMETIC IN THE FEATURE. The chart's write path
// converts NARROWLY: a height is inches only when the unit starts with `i` or `"` and is otherwise
// assumed CENTIMETRES; a weight is pounds only when the unit starts with `l` or `p` and is otherwise
// assumed KILOGRAMS. So passing `1.73 m` straight through charts a 1.73 cm patient.
//
// Therefore everything here does two things at once: recognise the unit as written, OPEN-ENDEDLY
// (providers write cm, m, mm, inches, feet, feet+inches, kg, g, lb, lb+oz, stones), and convert into
// a unit the client provably handles. Recognition and conversion are the same table row so they
// cannot drift.
//
// AND: an unrecognised unit must NOT fall back to the default. Silently reading `1.73 stones` as kg
// charts a number nobody stated. Report it and ask.

import { PlannableVitalField } from './actions';

interface UnitRule {
  /** Matches the unit as written, at the end of the matched reading. */
  pattern: RegExp;
  /** The unit handed to the client, and the factor from the written unit into it. */
  canonical: string;
  factor: number;
}

// Note `(?<![a-z])` rather than a leading `\b`. A unit legitimately abuts its number (`130lb`,
// `1.73m` — there is NO word boundary between a digit and a letter, so `\blb\b` fails on `130lb`),
// but it must not match inside a longer word (`grams` must not yield the `ms` of metres).
const HEIGHT_UNITS: UnitRule[] = [
  { pattern: /(?<![a-z])(?:millimet(?:er|re)s?|mm)\b/i, canonical: 'cm', factor: 0.1 },
  { pattern: /(?<![a-z])(?:centimet(?:er|re)s?|cms?)\b/i, canonical: 'cm', factor: 1 },
  { pattern: /(?<![a-z])(?:met(?:er|re)s?|ms?)\b/i, canonical: 'cm', factor: 100 },
  { pattern: /(?<![a-z])(?:inch(?:es)?|ins?)\b|"|''/i, canonical: 'in', factor: 1 },
  { pattern: /(?<![a-z])(?:feet|foot|ft)\b|'/i, canonical: 'in', factor: 12 },
];

const WEIGHT_UNITS: UnitRule[] = [
  { pattern: /(?<![a-z])(?:milligrams?|mg)\b/i, canonical: 'kg', factor: 0.000001 },
  { pattern: /(?<![a-z])(?:kilograms?|kilos?|kgs?)\b/i, canonical: 'kg', factor: 1 },
  { pattern: /(?<![a-z])(?:grams?|gs?)\b/i, canonical: 'kg', factor: 0.001 },
  { pattern: /(?<![a-z])(?:pounds?|lbs?)\b|#/i, canonical: 'lb', factor: 1 },
  { pattern: /(?<![a-z])(?:ounces?|oz)\b/i, canonical: 'lb', factor: 1 / 16 },
  { pattern: /(?<![a-z])(?:stones?|st)\b/i, canonical: 'lb', factor: 14 },
];

const UNIT_TABLES: Partial<Record<PlannableVitalField, UnitRule[]>> = {
  'vital-height': HEIGHT_UNITS,
  'vital-weight': WEIGHT_UNITS,
};

/**
 * Convert one written unit into a unit the client handles. Returns undefined when the unit is not
 * recognised — the caller MUST treat that as "ask the provider", never as "use the default".
 */
export function canonicalizeVitalUnit(
  field: string,
  value: number,
  writtenUnit: string
): { value: number; unit: string } | undefined {
  const rules = UNIT_TABLES[field as PlannableVitalField];
  if (!rules) return undefined;
  const rule = rules.find((r) => r.pattern.test(writtenUnit));
  if (!rule) return undefined;
  // Round to 2dp: 5 st → 70 lb must not surface as 69.99999999999999.
  return { value: Math.round(value * rule.factor * 100) / 100, unit: rule.canonical };
}

export const MIN_PLAUSIBLE_HEIGHT_IN = 20;
export const MIN_PLAUSIBLE_HEIGHT_CM = 51;

/**
 * 20 in / 51 cm is below any live-birth length, so anything under it is a mis-stated unit rather
 * than a measurement. `5.8 inches` is decimal feet written as inches — 15 cm. Do NOT chart it, and do
 * NOT silently reinterpret it as 5'8": that charts a number the provider never wrote. Ask.
 * Paediatric heights (34 in / 86 cm) must still pass.
 */
export function isImplausibleHeight(value: number, unit: string | undefined): boolean {
  if (!Number.isFinite(value) || value <= 0) return true;
  return /^c/i.test(unit ?? '') ? value < MIN_PLAUSIBLE_HEIGHT_CM : value < MIN_PLAUSIBLE_HEIGHT_IN;
}

// ---------------------------------------------------------------------------------------------
// Reading a dictated vital
// ---------------------------------------------------------------------------------------------

export type VitalParse =
  | { status: 'ok'; value: number; unit?: string; caution?: string }
  | { status: 'ok-bp'; systolic: number; diastolic: number }
  /** A unit was written that we do not recognise. Report it — never default. */
  | { status: 'unrecognized-unit'; writtenUnit: string; reason: string }
  /** A bare number for a vital whose unit is genuinely ambiguous (height, weight). Ask. */
  | { status: 'missing-unit'; value: number; reason: string }
  /** Physiologically impossible as written — almost always a mis-stated unit. Ask. */
  | { status: 'implausible'; value: number; unit?: string; reason: string }
  | { status: 'no-value'; reason: string };

const NUMBER = String.raw`\d+(?:\.\d+)?`;

/** 5'8" · 5 ft 8 in · 5 feet 8 inches. MUST be tried before the single-unit pattern, or a bare `5 ft` wins. */
const FEET_INCHES = new RegExp(
  String.raw`(${NUMBER})\s*(?:'|ft\b|feet\b|foot\b)\s*(${NUMBER})\s*(?:"|''|in\b|ins\b|inch\b|inches\b)?`,
  'i'
);
/** 9 lb 4 oz. */
const POUNDS_OUNCES = new RegExp(
  String.raw`(${NUMBER})\s*(?:#|lbs?\b|pounds?\b)\s*(${NUMBER})\s*(?:oz\b|ounces?\b)`,
  'i'
);
const BLOOD_PRESSURE = /(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/i;
/** A number followed by whatever unit text trails it, up to the next number or end. */
const NUMBER_WITH_TRAILING_UNIT = new RegExp(String.raw`(${NUMBER})\s*([^\d,;]*)`, 'i');

/** The scale as written. Group 1 starts with f or c, which is all the caller needs. */
const TEMPERATURE_SCALE = /(?:°\s*)?\b(fahrenheit|celsius|centigrade|f|c)\b/i;
/** Unit text that carries no scale and is safe to ignore: "degrees", "°", "%" from a stray paste. */
const TEMPERATURE_UNITLESS_NOISE = /^[\s°%]*(?:degrees?)?[\s°]*$/i;

/**
 * Physiologic bounds used only to catch a mis-stated unit, not to second-guess a clinician. Ranges
 * are deliberately wide: a value outside them is a data-entry error, not an unusual patient.
 */
const PLAUSIBLE_RANGES: Partial<Record<PlannableVitalField, { min: number; max: number; unit?: string }>> = {
  'vital-heartbeat': { min: 20, max: 300 },
  'vital-respiration-rate': { min: 4, max: 100 },
  'vital-oxygen-sat': { min: 40, max: 100 },
};

/**
 * Parse the reading out of a `set-vital` display string, converting into a unit the client handles.
 *
 * Everything ambiguous returns a non-`ok` status. The caller's job is then to skip the step with an
 * honest reason and ask the provider — never to pick the more likely interpretation.
 */
export function parseVitalDisplay(field: PlannableVitalField, display: string): VitalParse {
  const text = (display ?? '').trim();
  if (!text) return { status: 'no-value', reason: 'no reading was given' };

  if (field === 'vital-blood-pressure') {
    const match = BLOOD_PRESSURE.exec(text);
    if (!match) return { status: 'no-value', reason: `could not read a blood pressure from "${text}"` };
    return { status: 'ok-bp', systolic: Number(match[1]), diastolic: Number(match[2]) };
  }

  if (field === 'vital-height') {
    const compound = FEET_INCHES.exec(text);
    if (compound) {
      const inches = Number(compound[1]) * 12 + Number(compound[2]);
      return finishHeight(inches, 'in', text);
    }
    return parseSingleUnit(field, text, (value, writtenUnit) => {
      if (!writtenUnit) {
        return {
          status: 'missing-unit',
          value,
          reason: `"${text}" has no unit — a bare height could be centimetres or inches, so it needs confirming`,
        };
      }
      const converted = canonicalizeVitalUnit(field, value, writtenUnit);
      if (!converted) {
        return {
          status: 'unrecognized-unit',
          writtenUnit,
          reason: `"${writtenUnit}" is not a height unit this system converts, so "${text}" was not charted`,
        };
      }
      return finishHeight(converted.value, converted.unit, text);
    });
  }

  if (field === 'vital-weight') {
    const compound = POUNDS_OUNCES.exec(text);
    if (compound) {
      const pounds = Math.round((Number(compound[1]) + Number(compound[2]) / 16) * 100) / 100;
      return { status: 'ok', value: pounds, unit: 'lb' };
    }
    return parseSingleUnit(field, text, (value, writtenUnit) => {
      if (!writtenUnit) {
        return {
          status: 'missing-unit',
          value,
          reason: `"${text}" has no unit — a bare weight could be kilograms or pounds, so it needs confirming`,
        };
      }
      const converted = canonicalizeVitalUnit(field, value, writtenUnit);
      if (!converted) {
        return {
          status: 'unrecognized-unit',
          writtenUnit,
          reason: `"${writtenUnit}" is not a weight unit this system converts, so "${text}" was not charted`,
        };
      }
      if (converted.value <= 0) {
        return { status: 'implausible', value: converted.value, unit: converted.unit, reason: 'weight must be above 0' };
      }
      return { status: 'ok', value: converted.value, unit: converted.unit };
    });
  }

  if (field === 'vital-temperature') {
    return parseSingleUnit(field, text, (value, writtenUnit) => {
      const scale = TEMPERATURE_SCALE.exec(writtenUnit);
      let unit: string;
      let caution: string | undefined;
      if (scale) {
        unit = /^c/i.test(scale[1]) ? 'C' : 'F';
      } else if (writtenUnit && !TEMPERATURE_UNITLESS_NOISE.test(writtenUnit)) {
        return {
          status: 'unrecognized-unit',
          writtenUnit,
          reason: `"${writtenUnit}" is not a temperature unit, so "${text}" was not charted`,
        };
      } else {
        // No scale written. Fahrenheit and Celsius do not overlap anywhere near a living patient, so
        // this is forced by physiology rather than guessed — but it is still flagged so the provider
        // sees which way it was read.
        unit = value >= 45 ? 'F' : 'C';
        caution = `no unit was stated; read as °${unit} from the value`;
      }
      const plausible = unit === 'C' ? value >= 25 && value <= 45 : value >= 77 && value <= 113;
      if (!plausible) {
        return {
          status: 'implausible',
          value,
          unit,
          reason: `${value} °${unit} is outside any survivable body temperature`,
        };
      }
      return { status: 'ok', value, unit, caution };
    });
  }

  // Heart rate, respiration rate, oxygen saturation: the stored unit is fixed, so a bare number is
  // unambiguous. Anything else trailing the number is noise (bpm, %, "on room air").
  return parseSingleUnit(field, text, (value) => {
    const range = PLAUSIBLE_RANGES[field];
    if (range && (value < range.min || value > range.max)) {
      return {
        status: 'implausible',
        value,
        reason: `${value} is outside the plausible range ${range.min}–${range.max} for this vital`,
      };
    }
    return { status: 'ok', value };
  });
}

function finishHeight(value: number, unit: string, text: string): VitalParse {
  if (isImplausibleHeight(value, unit)) {
    return {
      status: 'implausible',
      value,
      unit,
      reason:
        `"${text}" reads as ${value} ${unit}, which is below any live-birth length — almost certainly a ` +
        `mis-stated unit (e.g. decimal feet written as inches)`,
    };
  }
  return { status: 'ok', value, unit };
}

function parseSingleUnit(
  field: PlannableVitalField,
  text: string,
  finish: (value: number, writtenUnit: string) => VitalParse
): VitalParse {
  const match = NUMBER_WITH_TRAILING_UNIT.exec(text);
  if (!match) return { status: 'no-value', reason: `could not read a number from "${text}" for ${field}` };
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return { status: 'no-value', reason: `could not read a number from "${text}"` };
  return finish(value, (match[2] ?? '').trim());
}

// ---------------------------------------------------------------------------------------------
// Recovering a reading the model dropped
// ---------------------------------------------------------------------------------------------

// The model is inconsistent about populating optional fields: it will emit
// `{kind:'set-vital', field:'vital-height'}` with no display at all. Recover the reading from the
// provider's OWN words — for EVERY vital, not just blood pressure. (The first implementation had
// this fallback only for blood pressure, so `add height 5.8 inches` answered "I need a value for
// that vital" while the number sat in the message.)
//
// Every pattern is ANCHORED on the unit keyword or the vital's own keyword, so `cough for 5 days` is
// never read as a measurement.
const RECOVERY_PATTERNS: Record<PlannableVitalField, RegExp[]> = {
  'vital-blood-pressure': [new RegExp(String.raw`\b\d{2,3}\s*(?:\/|over)\s*\d{2,3}\b`, 'i')],
  'vital-height': [
    // Group 1 wraps the WHOLE compound reading: `recoverVitalReading` returns match[1], so capturing
    // only the feet number would hand `5'8"` back as a bare `5`.
    new RegExp(String.raw`(${NUMBER}\s*(?:'|ft\b|feet\b|foot\b)\s*${NUMBER}\s*(?:"|''|in\b|inch(?:es)?\b)?)`, 'i'),
    new RegExp(
      String.raw`(?:height|tall|measures)\D{0,12}(${NUMBER}\s*(?:cm\b|centimet\w*|mm\b|millimet\w*|m\b|met(?:er|re)s?\b|in\b|ins\b|inch(?:es)?\b|"|''|ft\b|feet\b|foot\b|'))`,
      'i'
    ),
    new RegExp(
      String.raw`(${NUMBER}\s*(?:cm\b|centimet\w*|millimet\w*|mm\b|met(?:er|re)s?\b|inch(?:es)?\b|ins?\b|"|''))`,
      'i'
    ),
  ],
  'vital-weight': [
    new RegExp(String.raw`(${NUMBER}\s*(?:#|lbs?\b|pounds?\b)\s*${NUMBER}\s*(?:oz\b|ounces?\b))`, 'i'),
    new RegExp(
      String.raw`(?:weigh\w*|weight)\D{0,12}(${NUMBER}\s*(?:kgs?\b|kilos?\b|kilograms?\b|lbs?\b|pounds?\b|#|grams?\b|g\b|stones?\b|st\b))`,
      'i'
    ),
    new RegExp(
      String.raw`(${NUMBER}\s*(?:kgs?\b|kilos?\b|kilograms?\b|lbs?\b|pounds?\b|#|stones?\b))`,
      'i'
    ),
  ],
  'vital-temperature': [
    new RegExp(String.raw`(${NUMBER}\s*(?:°\s*)?(?:f\b|c\b|degrees?\b|fahrenheit\b|celsius\b))`, 'i'),
    new RegExp(String.raw`(?:temp\w*|fever|febrile)\D{0,12}(${NUMBER}(?:\s*(?:°\s*)?[fc]\b)?)`, 'i'),
  ],
  'vital-heartbeat': [
    new RegExp(String.raw`(${NUMBER}\s*bpm\b)`, 'i'),
    new RegExp(String.raw`(?:heart\s*rate|pulse|\bhr\b)\D{0,12}(${NUMBER})`, 'i'),
  ],
  'vital-respiration-rate': [
    new RegExp(
      String.raw`(?:respirat\w*\s*rate|resp\s*rate|respirations?|\brr\b)\D{0,12}(${NUMBER})`,
      'i'
    ),
  ],
  'vital-oxygen-sat': [
    new RegExp(String.raw`(${NUMBER}\s*(?:%|percent\b))`, 'i'),
    new RegExp(String.raw`(?:o2\s*sat\w*|oxygen\s*sat\w*|\bspo2\b|\bsats?\b|saturation)\D{0,12}(${NUMBER})`, 'i'),
  ],
};

/**
 * Find the reading for `field` in the provider's own message. Returns the matched substring, ready
 * to hand to `parseVitalDisplay`, or undefined when the message does not state one.
 */
export function recoverVitalReading(field: PlannableVitalField, narrative: string): string | undefined {
  if (!narrative) return undefined;
  for (const pattern of RECOVERY_PATTERNS[field]) {
    const match = pattern.exec(narrative);
    if (match) return (match[1] ?? match[0]).trim();
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------------------------

// Kept as a diagnostic, not a router. The first implementation used a length/sentence heuristic to
// choose between a "single command" endpoint that returned exactly ONE action and a planner: the
// message `patient is 5'8", weighs 130lb` is 30 characters and one sentence, so it routed to the
// single-action endpoint and one of the two vitals was SILENTLY DROPPED. There is now one endpoint
// that always returns 1..N actions, which removes the heuristic and the whole failure class. These
// patterns survive only to let the client detect a multi-reading message for telemetry and tests.
export const VITAL_READING_PATTERNS: RegExp[] = [
  /\b\d{2,3}\s*(?:\/|over)\s*\d{2,3}\b/i, // blood pressure
  /\d+(?:\.\d+)?\s*(?:lbs?\b|pounds?\b|kgs?\b|kilos?\b|kilograms?\b)/i, // weight
  /\d+(?:\.\d+)?\s*(?:"|''|in\b|inch(?:es)?\b|ft\b|feet\b|foot\b|cm\b|centimet)/i, // height
  /\d+(?:\.\d+)?\s*(?:°|degrees?\b|\bf\b|\bc\b|fahrenheit|celsius)/i, // temperature
  /\d{2,3}\s*(?:%|percent)/i, // oxygen saturation
];

export function countVitalReadings(message: string): number {
  return VITAL_READING_PATTERNS.filter((re) => re.test(message)).length;
}
