// Shared set-vital normalization, used by BOTH the narrative planner and the single-shot agent so a
// loosely-specified vital ("temp 102.2 F", "BP 122/78", "heart rate 110") is turned into the
// {value, unit, systolic, diastolic, display} shape the client's set-vital handler consumes.
//
// The LLM is asked only to emit { kind, field, display }; everything numeric is recovered here from
// `display` (and, for blood pressure, the surrounding `contextText` — the narrative or the user's
// message). flash-lite in particular is inconsistent about populating the numeric fields, so this is
// the single source of truth for parsing them.
import { EasyChartVitalField } from 'utils/lib/types/data/easy-chart-agent.types';

// The runtime allowlist the zambdas check the model's `field` against before casting it to
// EasyChartVitalField. `satisfies` proves no entry here is absent from that union; the assertion
// below proves the reverse — a vital added to the intent type but not to this list would otherwise be
// rejected at runtime as "Which vital?" despite type-checking everywhere.
export const VITAL_FIELDS = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-oxygen-sat',
  'vital-blood-pressure',
  'vital-weight',
  'vital-height',
] as const satisfies readonly EasyChartVitalField[];
type AssertTrue<T extends true> = T;
export type VitalFieldsCoverIntent = AssertTrue<
  [EasyChartVitalField] extends [(typeof VITAL_FIELDS)[number]] ? true : false
>;

const VITAL_LABEL: Record<string, string> = {
  'vital-temperature': 'Temp',
  'vital-heartbeat': 'HR',
  'vital-respiration-rate': 'RR',
  'vital-oxygen-sat': 'SpO2',
  'vital-weight': 'Weight',
  'vital-height': 'Height',
};

// Per-field patterns for recovering a reading from the ORIGINAL TEXT when the model gave no display.
// Unit-anchored on purpose: for weight/height the unit word is what makes a number a reading, so an
// unrelated number in the message ("5 days of cough") can never be mistaken for one. Temperature and
// the unitless vitals anchor on their own keyword instead.
// UNIT TABLE. Providers write whatever unit they think in — cm, m, mm, inches, feet, kg, g, lb, oz,
// stones — so recognition must be open-ended. But the CLIENT converts narrowly: it reads a height as
// inches only when the unit starts with `i`/`"` and otherwise assumes CENTIMETRES, and a weight as
// pounds only when the unit starts with `l`/`p` and otherwise assumes KILOGRAMS. Passing "1.73 m"
// straight through would therefore chart a 1.73 cm patient.
//
// So every recognized unit is converted HERE into one the client provably handles: heights become
// `cm` or `in`, weights become `kg` or `lb`. Adding a unit means adding one row — recognition and
// conversion can't drift apart because they're the same row.
interface UnitRule {
  // Matches the unit as written, at the end of the matched reading.
  pattern: RegExp;
  // The unit handed to the client, and the factor from the written unit into it.
  canonical: string;
  factor: number;
}
// Unit tokens use `(?<![a-z])` rather than a leading `\b`: a unit legitimately abuts its number
// ("130lb", "1.73m" — there is no word boundary between a digit and a letter), but it must not be
// matched inside a longer word ("grams" must not yield the "ms" of metres). Trailing `\b` keeps
// "in" from matching the start of "infant". Order matters — longer/more specific first.
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
const UNIT_TABLES: Record<string, UnitRule[]> = { 'vital-height': HEIGHT_UNITS, 'vital-weight': WEIGHT_UNITS };

// One alternation covering every unit a field accepts, so the text patterns below stay in step with
// the table above instead of repeating a hand-written subset of it.
function unitAlternation(rules: UnitRule[]): string {
  return rules.map((r) => r.pattern.source).join('|');
}

// Convert a written reading into the canonical unit the client understands. Returns undefined when the
// unit isn't recognized at all — the caller then asks rather than assuming a default.
export function canonicalizeVitalUnit(
  field: string,
  value: number,
  writtenUnit: string
): { value: number; unit: string } | undefined {
  const rules = UNIT_TABLES[field];
  if (!rules) return undefined;
  const rule = rules.find((r) => r.pattern.test(writtenUnit));
  if (!rule) return undefined;
  // Round to 2dp: 5 st → 70 lb must not surface as 69.99999999999999.
  return { value: Math.round(value * rule.factor * 100) / 100, unit: rule.canonical };
}

const VITAL_TEXT_PATTERNS: Record<string, RegExp[]> = {
  'vital-height': [
    // Compound imperial first: "5'8", "5 ft 8", "5 feet 8 inches" — a bare "5 ft" would otherwise win.
    /\b(\d)\s*(?:'|ft\b|feet\b|foot\b)\s*(\d{1,2})?\s*(?:"|in\b|inch(?:es)?\b)?/i,
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitAlternation(HEIGHT_UNITS)})`, 'i'),
  ],
  'vital-weight': [
    // Compound imperial: "9 lb 4 oz" (newborn weights are written this way).
    /(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?)\s*(\d+(?:\.\d+)?)\s*(?:ounces?|oz)\b/i,
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitAlternation(WEIGHT_UNITS)})`, 'i'),
  ],
  'vital-temperature': [/(?:temp(?:erature)?|fever)\D{0,15}(\d{2,3}(?:\.\d)?)/i],
  'vital-heartbeat': [/(?:heart rate|pulse|\bhr\b)\D{0,15}(\d{2,3})/i],
  'vital-respiration-rate': [/(?:respirator(?:y|ion)s? rate|respirations?|\brr\b)\D{0,15}(\d{1,2})/i],
  'vital-oxygen-sat': [/(?:oxygen sat(?:uration)?|o2 sat(?:uration)?|\bspo2\b|\bsats?\b)\D{0,15}(\d{2,3})/i],
};

export interface VitalTextMatch {
  value: number;
  unit?: string;
  display: string;
}

// Find this vital's reading in free text, in whatever unit it was written, converted to the canonical
// one. Exported for unit tests.
export function matchVitalInText(field: string, text: string): VitalTextMatch | undefined {
  const patterns = VITAL_TEXT_PATTERNS[field] ?? [];
  for (const [idx, re] of patterns.entries()) {
    const m = text.match(re);
    if (!m) continue;
    const display = m[0].trim();
    // The first pattern of height/weight is the COMPOUND imperial form (feet+inches, pounds+ounces):
    // both captures are magnitudes in the same system, not a unit token.
    if (idx === 0 && field === 'vital-height') {
      return { value: Number(m[1]) * 12 + (m[2] ? Number(m[2]) : 0), unit: 'in', display };
    }
    if (idx === 0 && field === 'vital-weight') {
      return { value: Math.round((Number(m[1]) + Number(m[2]) / 16) * 100) / 100, unit: 'lb', display };
    }
    const canonical = m[2] ? canonicalizeVitalUnit(field, Number(m[1]), m[2]) : undefined;
    return canonical ? { ...canonical, display } : { value: Number(m[1]), display };
  }
  return undefined;
}

// A height a human cannot have. 20 in (~51 cm) is below any live birth length, so anything under it is
// a mis-stated unit rather than a measurement — most often decimal feet typed as inches ("5.8 inches"
// meaning 5'8"). Charting 5.8 in silently would put a 15 cm patient in the record, so the caller asks
// instead of guessing which of the two the provider meant.
export const MIN_PLAUSIBLE_HEIGHT_IN = 20;
export const MIN_PLAUSIBLE_HEIGHT_CM = 51;
export function isImplausibleHeight(value: number, unit: string | undefined): boolean {
  if (!Number.isFinite(value) || value <= 0) return true;
  return /^c/i.test(unit ?? '') ? value < MIN_PLAUSIBLE_HEIGHT_CM : value < MIN_PLAUSIBLE_HEIGHT_IN;
}

// Normalize a raw set-vital intent record in place. `contextText` is the narrative (planner) or the
// user's message (agent) — used to recover a reading the model dropped from `display`.
export function normalizeVitalIntent(i: Record<string, unknown>, contextText: string): void {
  const d0 = typeof i.display === 'string' ? i.display : '';
  if (i.field === 'vital-blood-pressure') {
    if (i.systolic == null || i.diastolic == null) {
      const m = `${d0} ${contextText}`.match(/(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/i);
      if (m) {
        i.systolic = Number(m[1]);
        i.diastolic = Number(m[2]);
      }
    }
    delete i.value;
    delete i.unit;
    if (i.systolic != null && i.diastolic != null) i.display = `BP ${i.systolic}/${i.diastolic}`;
    return;
  }
  // Recover the number from `display`, and — when the model left display out entirely — from the
  // ORIGINAL TEXT. Blood pressure has always had that second fallback; the other six vitals did not,
  // so a model that emitted a bare {kind:'set-vital', field:'vital-height'} produced "I need a value
  // for that vital" even though the number was right there in the provider's message ("add height 5.8
  // inches"). Scoped to the same unit keywords the field cares about, so an unrelated number in a
  // longer message can't be captured as the reading.
  if (typeof i.value !== 'number' || Number.isNaN(i.value)) {
    const m = d0.match(/-?\d+(?:\.\d+)?/);
    if (m) i.value = Number(m[0]);
    else {
      const fromContext = matchVitalInText(i.field as string, contextText);
      if (fromContext) {
        i.value = fromContext.value;
        if (fromContext.unit) i.unit = fromContext.unit;
        // Give the height/feet-inches and unit logic below something to read.
        if (!d0) i.display = fromContext.display;
      }
    }
  }
  if (i.field === 'vital-temperature') {
    // Resolve the unit: an explicit Celsius marker wins — "celsius" or a standalone C token
    // ("°C", "38.5 c", "100.4C"). The C must not be preceded by a letter, so a word that merely
    // ends in "c" ("tympanic") never counts. Otherwise infer by magnitude (human temps are
    // ~95–105 °F vs ~35–41 °C), defaulting to Fahrenheit.
    if (/celsius|(?<![a-z])c\b/i.test(d0)) i.unit = 'C';
    else if (typeof i.unit !== 'string' || !/^[cf]/i.test(i.unit.trim())) {
      i.unit = typeof i.value === 'number' && i.value < 45 ? 'C' : 'F';
    }
  }
  if (i.field === 'vital-weight' || i.field === 'vital-height') {
    // Resolve the unit from whatever the provider wrote — the explicit `unit` field first, otherwise
    // the wording in `display` (which may itself have come from the context fallback above). Both go
    // through the same unit table, so "9 lb 4 oz", "5 st", "1.73 m" and "68 in" are all understood and
    // all leave here in a unit the client converts correctly.
    const writtenUnit = typeof i.unit === 'string' ? i.unit.trim() : '';
    const text = typeof i.display === 'string' && i.display.trim() ? i.display : d0;
    const fromText = matchVitalInText(i.field, text);
    if (fromText && (fromText.unit || !writtenUnit)) {
      // The text carries a unit (or there's no declared unit to trust) — the text wins, because it is
      // the provider's own wording and it also resolves compound forms the `unit` field can't express.
      if (fromText.unit) i.unit = fromText.unit;
      i.value = fromText.value;
    } else if (writtenUnit && typeof i.value === 'number') {
      const canonical = canonicalizeVitalUnit(i.field, i.value, writtenUnit);
      if (canonical) {
        i.value = canonical.value;
        i.unit = canonical.unit;
      } else {
        // An unrecognized unit is NOT assumed to be the default: silently reading "1.73 stones" as kg
        // is how a wrong number gets charted. Report it instead.
        i.unrecognizedUnit = writtenUnit;
        delete i.value;
      }
    }
    // Physiologically impossible height → drop the value so the caller asks instead of charting it.
    // "5.8 inches" is the common case: decimal feet written as inches. Guessing 5'8" would put an
    // unverified number in the record; guessing 5.8 in would put a 15 cm patient there.
    if (
      i.field === 'vital-height' &&
      typeof i.value === 'number' &&
      isImplausibleHeight(i.value, typeof i.unit === 'string' ? i.unit : undefined)
    ) {
      i.implausible = `${i.value}${i.unit ? ` ${i.unit}` : ''}`;
      delete i.value;
    }
  }
  if ((typeof i.display !== 'string' || !i.display.trim()) && typeof i.value === 'number') {
    const suffix = i.field === 'vital-temperature' ? ` °${i.unit}` : i.field === 'vital-oxygen-sat' ? '%' : '';
    i.display = `${VITAL_LABEL[i.field as string] ?? i.field} ${i.value}${suffix}`;
  }
}

// Deterministic narrative sweep: find vital readings stated in the narrative so the planner can
// append any the model failed to emit (it reliably reports the FIRST reading but drops rechecks —
// "a repeat manual blood pressure dropped slightly to 176 over 92" — and sometimes whole vitals).
// Keyword-anchored patterns with physiologic range checks keep false positives out ("20/20 vision"
// has no BP keyword; "pulses 2+" fails the 2-digit requirement).
export interface SniffedVital {
  field: string;
  display: string;
  systolic?: number;
  diastolic?: number;
  value?: number;
  unit?: string;
  sourceText: string;
}
export function sniffVitalsFromNarrative(narrative: string): SniffedVital[] {
  const out: SniffedVital[] = [];
  const sentences = narrative.split(/(?<=[.!?])\s+/);
  const push = (v: SniffedVital): void => {
    // one entry per field+value signature — identical restatements collapse
    const sig = (x: SniffedVital): string => `${x.field}|${x.systolic ?? ''}/${x.diastolic ?? ''}|${x.value ?? ''}`;
    if (!out.some((x) => sig(x) === sig(v))) out.push(v);
  };
  for (const sentence of sentences) {
    const src = sentence.trim();
    // Instruction/threshold sentences ("return precautions for saturation readings below 90 at
    // home") state LIMITS, not measurements — never sweep numbers out of them.
    if (
      /\b(?:return precautions?|advis|instruct|counsel|call 911|seek emergency|go straight|below|above|less than|greater than|drops? under|exceed)\b/i.test(
        sentence
      )
    ) {
      continue;
    }
    for (const m of sentence.matchAll(/(?:blood pressure|\bbp\b)[^.;]{0,60}?(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/gi)) {
      const sys = parseInt(m[1], 10);
      const dia = parseInt(m[2], 10);
      if (sys >= 60 && sys <= 260 && dia >= 30 && dia <= 160 && sys > dia) {
        push({
          field: 'vital-blood-pressure',
          display: `${sys}/${dia}`,
          systolic: sys,
          diastolic: dia,
          sourceText: src,
        });
      }
    }
    for (const m of sentence.matchAll(/(?:heart rate|\bpulse\b|\bhr\b)[^.;\d]{0,40}?(\d{2,3})\b/gi)) {
      const hr = parseInt(m[1], 10);
      if (hr >= 30 && hr <= 250) push({ field: 'vital-heartbeat', display: `${hr}`, value: hr, sourceText: src });
    }
    for (const m of sentence.matchAll(
      /(?:oxygen saturation|o2 sat(?:uration)?|\bspo2\b|\bsats?\b)[^.;\d]{0,30}?(\d{2,3})\s*(?:%|percent)?/gi
    )) {
      const sat = parseInt(m[1], 10);
      if (sat >= 50 && sat <= 100) push({ field: 'vital-oxygen-sat', display: `${sat}%`, value: sat, sourceText: src });
    }
    for (const m of sentence.matchAll(
      /(?:temperature|\btemp\b)[^.;\d]{0,30}?(\d{2,3}(?:\.\d)?)\s*(f|c|fahrenheit|celsius)?\b/gi
    )) {
      const t = parseFloat(m[1]);
      const unit = m[2] ? (m[2][0].toLowerCase() === 'c' ? 'C' : 'F') : t >= 90 ? 'F' : t >= 34 && t <= 44 ? 'C' : '';
      if ((unit === 'F' && t >= 90 && t <= 110) || (unit === 'C' && t >= 34 && t <= 44)) {
        push({ field: 'vital-temperature', display: `${t} ${unit}`, value: t, unit, sourceText: src });
      }
    }
    for (const m of sentence.matchAll(/(?:respiratory rate|respirations?\b|\brr\b)[^.;\d]{0,30}?(\d{1,2})\b/gi)) {
      const rr = parseInt(m[1], 10);
      if (rr >= 6 && rr <= 60) push({ field: 'vital-respiration-rate', display: `${rr}`, value: rr, sourceText: src });
    }
  }
  return out;
}
