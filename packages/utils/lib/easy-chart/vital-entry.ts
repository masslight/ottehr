// Typing a vital by hand, in either unit system.
//
// The provider says "she's 130 pounds" or "38 and a half" — and the chart stores canonical °C / kg /
// cm. Rather than making them convert, each vital exposes the unit boxes the regular Vitals cards
// offer, with live cross-conversion, and the canonical number is what gets saved.
//
// Pure and dependency-free apart from the repo's own vitals helpers, so Easy Chart and the regular
// vitals cards cannot disagree by a rounding rule — and so the parsing is unit-testable without a
// rendered page.

import { HeightMeasurement } from '../helpers/vitals/vitals-height.helper';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  roundTemperatureForSave,
} from '../helpers/vitals/vitals-temperature.helper';
import { formatWeightKg, formatWeightLbs, LBS_IN_KG } from '../helpers/vitals/vitals-weight.helper';
import { PlannableVitalField } from './actions';

/** Short labels, as a provider reads them on the note. */
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

/** Vitals whose unit is fixed, so their row shows it as a suffix rather than an editable box. */
export const VITAL_FIXED_UNIT: Record<string, string> = {
  'vital-oxygen-sat': '%',
  'vital-respiration-rate': '/min',
  'vital-heartbeat': 'bpm',
};

/** Round to at most 1 decimal and drop a trailing ".0", so 80.0 reads as 80. */
export const trimVitalNumber = (value: number): string => (Math.round(value * 10) / 10).toString();

const numberOrUndefined = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (trimmed === '' || Number.isNaN(Number(trimmed))) return undefined;
  return Number(trimmed);
};

/**
 * One editable unit box: parse the provider's text into the canonical stored number, and render the
 * canonical number back into this box's unit.
 */
export interface VitalUnitField {
  label: string;
  /** This box's text → canonical (°C / kg / cm). Undefined when the text is not a number. */
  parse: (text: string) => number | undefined;
  /** Canonical → this box's text. */
  render: (canonical: number) => string;
}

export interface VitalEntrySpec {
  fields: VitalUnitField[];
  /** Final rounding applied on the way to storage. */
  toStored: (canonical: number) => number;
}

/**
 * The unit boxes for a value-bearing vital. Blood pressure has its own two-number shape and does not
 * come through here.
 */
export function vitalEntrySpec(field: PlannableVitalField): VitalEntrySpec {
  if (field === 'vital-temperature') {
    return {
      fields: [
        { label: '°C', parse: numberOrUndefined, render: (c) => trimVitalNumber(c) },
        {
          label: '°F',
          parse: (text) => {
            const f = numberOrUndefined(text);
            return f == null ? undefined : fahrenheitToCelsius(f);
          },
          render: (c) => trimVitalNumber(celsiusToFahrenheit(c)),
        },
      ],
      toStored: (c) => roundTemperatureForSave(c),
    };
  }

  if (field === 'vital-weight') {
    return {
      fields: [
        { label: 'kg', parse: numberOrUndefined, render: (kg) => formatWeightKg(kg) },
        {
          label: 'lbs',
          parse: (text) => {
            const lbs = numberOrUndefined(text);
            return lbs == null ? undefined : lbs / LBS_IN_KG;
          },
          render: (kg) => formatWeightLbs(kg),
        },
      ],
      toStored: (kg) => Math.round(kg * 100) / 100,
    };
  }

  if (field === 'vital-height') {
    // Three ways in, the same three the regular height card offers: centimetres, total inches, and
    // feet + inches. HeightMeasurement owns the arithmetic so the conversions match exactly.
    return {
      fields: [
        {
          label: 'cm',
          parse: (text) => HeightMeasurement.fromCmText(text)?.inCm(),
          render: (cm) => trimVitalNumber(cm),
        },
        {
          label: 'in',
          parse: (text) => HeightMeasurement.fromInchesText(text)?.inCm(),
          render: (cm) => trimVitalNumber(HeightMeasurement.fromCm(cm).inInches()),
        },
      ],
      toStored: (cm) => Math.round(cm * 100) / 100,
    };
  }

  return {
    fields: [
      { label: VITAL_FIXED_UNIT[field] ?? '', parse: numberOrUndefined, render: (n) => trimVitalNumber(n) },
    ],
    toStored: (n) => n,
  };
}

/** The vitals the quick-add chips offer. Vision and LMP stay charted-only: they are not simple numerics. */
export const ADDABLE_VITAL_FIELDS: readonly PlannableVitalField[] = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-blood-pressure',
  'vital-oxygen-sat',
  'vital-weight',
  'vital-height',
];
