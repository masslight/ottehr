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

// Normalize a raw set-vital intent record in place. `contextText` is the narrative (planner) or the
// user's message (agent) — used to recover a blood-pressure pair the model dropped from `display`.
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
  if (typeof i.value !== 'number' || Number.isNaN(i.value)) {
    const m = d0.match(/-?\d+(?:\.\d+)?/);
    if (m) i.value = Number(m[0]);
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
  if (i.field === 'vital-weight') {
    // Canonicalize the unit to 'lb'/'kg' (the client converts lb→kg on save), recovering it from
    // `display` when the model left `unit` empty — "66 lbs" must never be stored as 66 kg.
    const u = typeof i.unit === 'string' ? i.unit.trim().toLowerCase() : '';
    if (/^(?:lb|pound)/.test(u) || (!u && /\b(?:lbs?|pounds?)\b/i.test(d0))) i.unit = 'lb';
    else if (/^(?:kg|kilo)/.test(u) || (!u && /\b(?:kgs?|kilos?|kilograms?)\b/i.test(d0))) i.unit = 'kg';
  }
  if (i.field === 'vital-height') {
    const u = typeof i.unit === 'string' ? i.unit.trim().toLowerCase() : '';
    // Feet+inches forms ("5'3\"", "5 ft 3", "6 feet") collapse to total inches.
    const ftIn = d0.match(/\b(\d)\s*(?:'|ft\b|feet\b|foot\b)\s*(\d{1,2})?/i);
    if (ftIn) {
      i.value = Number(ftIn[1]) * 12 + (ftIn[2] ? Number(ftIn[2]) : 0);
      i.unit = 'in';
    } else if (/^(?:in|")/.test(u) || (!u && /\b(?:in|inch(?:es)?)\b|"/i.test(d0))) i.unit = 'in';
    else if (/^(?:cm|centimet)/.test(u) || (!u && /\b(?:cm|centimet(?:er|re)s?)\b/i.test(d0))) i.unit = 'cm';
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
