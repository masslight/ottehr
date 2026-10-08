import { QuantityUnit } from '../../types/api/order-prescription.types';
import { assembleSentence, isSentenceBlank, SentenceBlank, SentenceSegment } from '../suggested-sentences';

/**
 * Generic prescription sentences offered for the medication on an eRx line: directions with the dose, frequency
 * and duration as blanks, and the dispense details (quantity, unit, days supply) worked out from those picks.
 * They depend only on the dose form read from the drug's description, never on the drug itself or the chart.
 */

export type PrescriptionDoseForm = 'tablet' | 'capsule' | 'liquid' | 'inhaler';

const DOSE_FORM_PATTERNS: [PrescriptionDoseForm, RegExp][] = [
  // Inhalers first: "Albuterol 90 MCG/ACTUAT Metered Dose Inhaler" also mentions inhalation.
  ['inhaler', /\b(inhaler|hfa|metered dose|inhalation aerosol)\b/i],
  ['capsule', /\bcapsules?\b/i],
  ['tablet', /\b(tablets?|caplets?|odt)\b/i],
  ['liquid', /\b(solution|suspension|syrup|elixir)\b/i],
];

/** The dose form named in a medication description ("Amoxicillin 500 MG Oral Capsule" → capsule), if one is known. */
export const prescriptionDoseForm = (description: string): PrescriptionDoseForm | undefined =>
  DOSE_FORM_PATTERNS.find(([, pattern]) => pattern.test(description))?.[0];

const QUANTITY_UNIT: Record<PrescriptionDoseForm, QuantityUnit> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  liquid: 'Milliliter',
  inhaler: 'Inhaler',
};

/** Frequencies with how many doses a day each one means, for the quantity to dispense. */
const SCHEDULED: Record<string, number> = {
  'once daily': 1,
  'twice daily': 2,
  'three times daily': 3,
  'four times daily': 4,
};

const AS_NEEDED: Record<string, number> = {
  'every 4 hours': 6,
  'every 6 hours': 4,
  'every 8 hours': 3,
};

const DOSES_PER_DAY: Record<string, number> = { ...SCHEDULED, ...AS_NEEDED };

const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '30 days'];

const DOSE_OPTIONS: Record<PrescriptionDoseForm, string[]> = {
  tablet: ['1 tablet', '2 tablets'],
  capsule: ['1 capsule', '2 capsules'],
  liquid: ['2.5 mL', '5 mL', '7.5 mL', '10 mL', '15 mL'],
  inhaler: ['1 puff', '2 puffs'],
};

const DOSE_TITLE = 'Dose';
const FREQUENCY_TITLE = 'Frequency';
const DURATION_TITLE = 'Duration';

const blank = (title: string, options: string[], initial: string): SentenceBlank => ({ title, options, initial });

export interface PrescriptionSuggestion {
  id: string;
  segments: SentenceSegment[];
  quantityUnit: QuantityUnit;
}

/** The sentences offered for a medication, or none when its dose form isn't one of the known ones. */
export const prescriptionSuggestions = (description: string): PrescriptionSuggestion[] => {
  const form = prescriptionDoseForm(description);
  if (!form) return [];
  const quantityUnit = QUANTITY_UNIT[form];
  const dose = (): SentenceBlank =>
    blank(DOSE_TITLE, DOSE_OPTIONS[form], DOSE_OPTIONS[form][form === 'liquid' ? 1 : 0]);
  const duration = (initial: string): SentenceBlank => blank(DURATION_TITLE, DURATIONS, initial);
  if (form === 'inhaler')
    return [
      {
        id: 'inhaler-as-needed',
        segments: [
          'Inhale ',
          blank(DOSE_TITLE, DOSE_OPTIONS.inhaler, '2 puffs'),
          ' ',
          blank(FREQUENCY_TITLE, Object.keys(AS_NEEDED), 'every 4 hours'),
          ' as needed for wheezing.',
        ],
        quantityUnit,
      },
    ];
  return [
    {
      id: `${form}-scheduled`,
      segments: [
        'Take ',
        dose(),
        ' by mouth ',
        blank(FREQUENCY_TITLE, Object.keys(SCHEDULED), 'twice daily'),
        ' for ',
        duration('10 days'),
        '.',
      ],
      quantityUnit,
    },
    {
      id: `${form}-as-needed`,
      segments: [
        'Take ',
        dose(),
        ' by mouth ',
        blank(FREQUENCY_TITLE, Object.keys(AS_NEEDED), 'every 6 hours'),
        ' as needed for up to ',
        duration('5 days'),
        '.',
      ],
      quantityUnit,
    },
  ];
};

/** What adding a suggestion writes into the prescription. Strings, as the form holds them. */
export interface SuggestedPrescriptionFields {
  quantityValue: string;
  quantityUnit: QuantityUnit;
  daysSupply: string;
  numberOfRefills: string;
  patientInstructions: string;
}

const leadingNumber = (value: string | undefined): number | undefined => {
  const number = value === undefined ? NaN : parseFloat(value);
  return Number.isFinite(number) ? number : undefined;
};

/** The suggestion as filled in: `picks[i]` overrides the blank at segment `i`, as in `assembleSentence`. An
 * inhaler is dispensed as one unit with no days supply; everything else is dose × doses a day × days. */
export const fillPrescriptionSuggestion = (
  suggestion: PrescriptionSuggestion,
  picks: (string | undefined)[]
): SuggestedPrescriptionFields => {
  const valueOf = (title: string): string | undefined => {
    const index = suggestion.segments.findIndex((segment) => isSentenceBlank(segment) && segment.title === title);
    const segment = suggestion.segments[index];
    return index < 0 || !isSentenceBlank(segment) ? undefined : picks[index] ?? segment.initial;
  };
  const days = leadingNumber(valueOf(DURATION_TITLE));
  const amount = leadingNumber(valueOf(DOSE_TITLE));
  const perDay = DOSES_PER_DAY[valueOf(FREQUENCY_TITLE) ?? ''];
  const quantity =
    suggestion.quantityUnit === 'Inhaler'
      ? 1
      : amount !== undefined && perDay !== undefined && days !== undefined
      ? Math.ceil(amount * perDay * days)
      : undefined;
  return {
    quantityValue: quantity === undefined ? '' : String(quantity),
    quantityUnit: suggestion.quantityUnit,
    daysSupply: suggestion.quantityUnit === 'Inhaler' || days === undefined ? '' : String(days),
    numberOfRefills: '0',
    patientInstructions: assembleSentence(suggestion.segments, picks),
  };
};
