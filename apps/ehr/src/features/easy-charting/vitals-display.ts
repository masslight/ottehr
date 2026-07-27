// Vitals display + unit-entry helpers for the easy-chart note (formatting stored metric values
// back into the practice-configured display units, and the editable unit-field descriptors).
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  formatHeightObservationValue,
  formatWeightKg,
  formatWeightLbs,
  LBS_IN_KG,
  roundTemperatureForSave,
  roundTemperatureValue,
  vitalsConfig,
  VitalsObservationDTO,
} from 'utils';

export const VITAL_LABEL: Record<string, string> = {
  'vital-temperature': 'Temp',
  'vital-heartbeat': 'HR',
  'vital-blood-pressure': 'BP',
  'vital-oxygen-sat': 'O₂ sat',
  'vital-respiration-rate': 'RR',
  'vital-weight': 'Weight',
  'vital-height': 'Height',
  'vital-vision': 'Vision',
  'vital-last-menstrual-period': 'LMP',
};

export const VITAL_UNIT: Record<string, string> = {
  'vital-oxygen-sat': '%',
  'vital-respiration-rate': '/min',
  'vital-heartbeat': 'bpm',
};

// The practice's configured weight display unit (kg or lbs). Temperature is always shown in both
// C ≈ F and height via the cm ≈ in ≈ ft′in″ label — those have no per-practice toggle.
export const WEIGHT_UNIT: 'kg' | 'lbs' = vitalsConfig['vital-weight'].unit;

// Round to at most 1 decimal and drop a trailing ".0" so "80.0" → "80".
export function trimNum(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// Format a weight (stored in kg) per the practice's configured unit, with the other unit as ≈.
export function formatWeightDisplay(kg: number): string {
  return WEIGHT_UNIT === 'kg'
    ? `${formatWeightKg(kg)} kg ≈ ${formatWeightLbs(kg)} lbs`
    : `${formatWeightLbs(kg)} lbs ≈ ${formatWeightKg(kg)} kg`;
}

// One editable unit field for a vital: parse the user's text into the canonical stored number, and
// render the canonical number back into this unit's text. This mirrors how the regular Vitals cards
// let a value be entered in metric OR imperial with live cross-conversion.
export interface VitalUnitField {
  label: string;
  parse: (text: string) => number | undefined; // text in this unit → canonical (°C / kg / cm)
  render: (canonical: number) => string; // canonical → text in this unit
}

export const numOrUndef = (t: string): number | undefined => {
  const s = t.trim();
  if (s === '' || Number.isNaN(Number(s))) return undefined;
  return Number(s);
};

// The editable unit field(s) for a value-bearing vital, plus the canonical→stored mapping. Vitals
// store canonical units (°C, kg); these let the provider type in either system and we convert,
// reusing the same helpers (fahrenheitToCelsius, LBS_IN_KG) the Vitals screen uses.
export function vitalUnitFields(field: string): { fields: VitalUnitField[]; toStored: (canonical: number) => number } {
  if (field === 'vital-temperature') {
    return {
      fields: [
        { label: '°C', parse: numOrUndef, render: (c) => trimNum(c) },
        {
          label: '°F',
          parse: (t) => {
            const f = numOrUndef(t);
            return f == null ? undefined : fahrenheitToCelsius(f);
          },
          render: (c) => trimNum(celsiusToFahrenheit(c)),
        },
      ],
      toStored: (c) => roundTemperatureForSave(c),
    };
  }
  if (field === 'vital-weight') {
    return {
      fields: [
        { label: 'kg', parse: numOrUndef, render: (kg) => formatWeightKg(kg) },
        {
          label: 'lbs',
          parse: (t) => {
            const l = numOrUndef(t);
            return l == null ? undefined : l / LBS_IN_KG;
          },
          render: (kg) => formatWeightLbs(kg),
        },
      ],
      toStored: (kg) => kg,
    };
  }
  // Height doesn't route through here: VitalEntryEditor gives it the regular height card's four-box
  // cm | total inches ≈ ft | in entry via HeightMeasurement directly.
  // Single-unit vitals (HR, RR, O₂ sat): one field, stored as entered.
  return {
    fields: [{ label: VITAL_UNIT[field] ?? '', parse: numOrUndef, render: (n) => trimNum(n) }],
    toStored: (n) => n,
  };
}

export function formatVital(v: VitalsObservationDTO): string {
  const label = VITAL_LABEL[v.field] ?? v.field;
  if (v.field === 'vital-blood-pressure') {
    return `${label}: ${v.systolicPressure}/${v.diastolicPressure} mmHg`;
  }
  // Vitals store canonical units (°C, kg, cm); display via the same helpers the regular vitals
  // screen uses so easy-chart reads identically (temp as "C ≈ F", weight in the practice's unit,
  // height as the cm ≈ in ≈ ft′in″ label).
  if (v.field === 'vital-temperature' && 'value' in v && v.value != null) {
    return `${label}: ${roundTemperatureValue(v.value)} C ≈ ${celsiusToFahrenheit(v.value).toFixed(1)} F`;
  }
  if (v.field === 'vital-weight' && 'extraWeightOptions' in v && v.extraWeightOptions?.includes('patient_refused')) {
    return `${label}: patient refused`;
  }
  if (v.field === 'vital-weight' && 'value' in v && v.value != null) {
    return `${label}: ${formatWeightDisplay(v.value)}`;
  }
  if (v.field === 'vital-height' && 'value' in v && v.value != null) {
    return `${label}: ${formatHeightObservationValue(v.value)}`;
  }
  if (v.field === 'vital-vision') {
    const eyes = [
      v.bothEyesVisionText ? `OU ${v.bothEyesVisionText}` : null,
      v.rightEyeVisionText ? `OD ${v.rightEyeVisionText}` : null,
      v.leftEyeVisionText ? `OS ${v.leftEyeVisionText}` : null,
    ].filter(Boolean);
    return `${label}: ${eyes.join(', ')}`;
  }
  if ('value' in v && v.value !== undefined && v.value !== null) {
    const unit = VITAL_UNIT[v.field] ?? '';
    return `${label}: ${trimNum(Number(v.value))}${unit ? ` ${unit}` : ''}`;
  }
  return label;
}
