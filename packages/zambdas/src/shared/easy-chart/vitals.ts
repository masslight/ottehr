// Shared set-vital normalization, used by BOTH the narrative planner and the single-shot agent so a
// loosely-specified vital ("temp 102.2 F", "BP 122/78", "heart rate 110") is turned into the
// {value, unit, systolic, diastolic, display} shape the client's set-vital handler consumes.
//
// The LLM is asked only to emit { kind, field, display }; everything numeric is recovered here from
// `display` (and, for blood pressure, the surrounding `contextText` — the narrative or the user's
// message). flash-lite in particular is inconsistent about populating the numeric fields, so this is
// the single source of truth for parsing them.

export const VITAL_FIELDS = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-oxygen-sat',
  'vital-blood-pressure',
  'vital-weight',
  'vital-height',
] as const;

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
    // Resolve the unit: explicit Celsius wins; otherwise infer by magnitude (human temps are
    // ~95–105 °F vs ~35–41 °C), defaulting to Fahrenheit.
    if (/celsius|(?:°|\bdeg(?:rees)?\b)?\s*c\b/i.test(d0)) i.unit = 'C';
    else if (typeof i.unit !== 'string' || !/^[cf]/i.test(i.unit.trim())) {
      i.unit = typeof i.value === 'number' && i.value < 45 ? 'C' : 'F';
    }
  }
  if ((typeof i.display !== 'string' || !i.display.trim()) && typeof i.value === 'number') {
    const suffix = i.field === 'vital-temperature' ? ` °${i.unit}` : i.field === 'vital-oxygen-sat' ? '%' : '';
    i.display = `${VITAL_LABEL[i.field as string] ?? i.field} ${i.value}${suffix}`;
  }
}
