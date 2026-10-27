import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { prescriptionSuggestionsFor } from '../erx/prescriptionSuggestions';
import { DoseCalculatorCardProps, DoseField, DoseWarningBox } from './DoseCalculatorCard';
import { ErxSuggestionRow, ErxSuggestionsBoxProps } from './ErxSuggestionsBox';

/** Every look with the catalogue's sample props (a 10-year-old, 28.12 kg, unless a look says otherwise), for the
 * local preview page and the component tests. Display strings only: nothing here is dosing data. */

export interface SampleLook<P> {
  tag: string;
  title: string;
  props: P;
  /** The prescription line the calculator opens under: its product, the dose unit and what follows. */
  line?: { medication: string; unit: string; rest: string };
}

const noop = (): void => undefined;

const diagnosisBlank = (title: string, initial?: string): SentenceBlank => ({
  title,
  options: ['Acute otitis media, unspecified H66.90', 'Acute obstructive laryngitis [croup] J05.0'],
  initial,
  optional: true,
});

type RowsProps = Extract<ErxSuggestionsBoxProps<ErxSuggestionRow>, { look: 'rows' }>;

const rows = (...list: Omit<ErxSuggestionRow, 'id'>[]): RowsProps => ({
  look: 'rows',
  rows: list.map((row, i) => ({ id: String(i), ...row })),
  onPick: noop,
  onOther: noop,
});

/** Sample quick picks for one product, as the order form's suggestions build their rows. */
const SAMPLE_PRODUCT = {
  ndc: '00093416173',
  description: 'Amoxicillin 400 mg/5ml Susp',
  rxcui: '308189',
  doseForm: 'Oral Suspension',
  ingredients: [{ name: 'amoxicillin', amount: 80, unit: 'MG', per: 1, perUnit: 'ML' }],
};
const SAMPLE_BY_WEIGHT: PrescriptionQuickPickData['dosing'] = {
  rate: 25,
  basis: 'mg/kg/dose',
  dosesPerDay: 2,
  frequency: 'twice daily',
  durationDays: 10,
};
const quickPickRows = (weightKg: number | undefined, ...quickPicks: PrescriptionQuickPickData[]): RowsProps => ({
  look: 'rows',
  rows: prescriptionSuggestionsFor({
    drug: null,
    medication: SAMPLE_PRODUCT,
    weightKg,
    diagnosisCodes: [],
    quickPicks: quickPicks.map((quickPick) => ({
      ndc: SAMPLE_PRODUCT.ndc,
      medicationDescription: SAMPLE_PRODUCT.description,
      rxcui: SAMPLE_PRODUCT.rxcui,
      doseForm: SAMPLE_PRODUCT.doseForm,
      ingredients: SAMPLE_PRODUCT.ingredients,
      ...quickPick,
    })),
  }),
  onPick: noop,
  onOther: noop,
});

export const SUGGESTION_LOOKS: SampleLook<ErxSuggestionsBoxProps<ErxSuggestionRow>>[] = [
  {
    tag: 'Row 1',
    title: 'Dosed row',
    props: rows({
      segments: ['Take 4.5 mL by mouth twice daily.'],
      reason: '28.12 kg × 25 mg/kg/day ÷ 2 = 351.5 mg → 4.5 mL = 360 mg (80 mg/mL)',
    }),
  },
  {
    tag: 'Row 2',
    title: 'Dosed row for a diagnosis',
    props: rows(
      {
        segments: ['Take 14.5 mL by mouth twice daily — for ', diagnosisBlank('Acute otitis media'), '.'],
        reason: '28.12 kg × 80 mg/kg/day ÷ 2 = 1124.8 mg → 14 mL = 1120 mg',
      },
      {
        segments: [
          'Take 120 mL by mouth once daily for 1 day — for ',
          diagnosisBlank('Croup', 'Acute obstructive laryngitis [croup] J05.0'),
          '.',
        ],
      }
    ),
  },
  {
    tag: 'Row 3',
    title: 'Label chart row',
    props: rows({
      segments: ['Take 12.5 mL by mouth every 6 to 8 hours as needed.'],
      reason: 'the OTC Drug Facts chart, 60–71 lb',
    }),
  },
  {
    tag: 'Row 4',
    title: 'Row with no amount',
    props: rows({ segments: ['Take by mouth three times daily (see the dose calculator).'] }),
  },
  { tag: 'Row 5', title: 'Needs a weight', props: rows({ segments: ['Take by mouth twice daily (dose by weight).'] }) },
  {
    tag: 'Row 6',
    title: 'Limit instead of a dose',
    props: rows({ segments: ['Inject into the outer thigh once — 30 kg and up.'] }),
  },
  { tag: 'Row 7', title: 'Write my own', props: rows() },
  {
    tag: 'Quick pick',
    title: 'Quick pick saved by weight',
    props: quickPickRows(28.12, { id: 'a', name: 'Sample by weight', dosing: SAMPLE_BY_WEIGHT }),
  },
  {
    tag: 'Quick pick',
    title: 'Quick pick at its maximum',
    props: quickPickRows(28.12, {
      id: 'b',
      name: 'Sample with a maximum',
      dosing: { ...SAMPLE_BY_WEIGHT, maxPerDoseMg: 500 },
    }),
  },
  {
    tag: 'Quick pick',
    title: 'Quick pick with a source',
    props: quickPickRows(28.12, {
      id: 'e',
      name: 'Amox strep, twice daily',
      dosing: { ...SAMPLE_BY_WEIGHT, maxPerDoseMg: 500, maxPerDayMg: 1000 },
      source: { label: 'Sample guideline', url: 'https://example.org/guideline' },
    }),
  },
  {
    tag: 'Quick pick',
    title: 'Quick pick by weight, no weight',
    props: quickPickRows(undefined, { id: 'c', name: 'Sample by weight', dosing: SAMPLE_BY_WEIGHT }),
  },
  {
    tag: 'Quick pick',
    title: 'Quick pick without dosing',
    props: quickPickRows(28.12, {
      id: 'd',
      name: 'Sample saved sentence',
      patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
    }),
  },
  {
    tag: 'Overlay',
    title: 'Cautions, notes and the weight note',
    props: {
      ...rows({
        segments: ['Take 6 mL by mouth once daily for 3 days — for ', diagnosisBlank('Croup'), '.'],
        caution: 'GINA 2026: “maximum of 40 mg/day” …',
        note: 'PDR “1 to 2 mg/kg/dose (Max: 60 mg/dose) …”',
      }),
      weightNote: 'using weight 18 kg (previous visit, 10/8/2026)',
    },
  },
  { tag: 'State', title: 'No box at all', props: { look: 'none' } },
  {
    tag: 'State',
    title: 'No rows, red warning',
    props: {
      look: 'contraindicated',
      message:
        'Promethazine is contraindicated in pediatric patients less than 2 years of age. No suggestions are shown.',
    },
  },
];

const WEIGHT: DoseField = { id: 'weight', label: 'Weight', value: '28.12', unit: 'kg' };
const field = (id: string, label: string, value: string, unit?: string, from?: string): DoseField => ({
  id,
  label,
  value,
  unit,
  from,
});
const regimen = (value: string, title = 'Regimen'): DoseCalculatorCardProps['picker'] => ({
  title,
  options: [value, 'Enter my own'],
  value,
  onChange: noop,
});

const AMOXICILLIN_LIQUID = {
  medication: 'Amoxicillin 400 mg/5 mL',
  unit: 'mL',
  rest: 'by mouth twice daily for 10 days.',
};

export const CALCULATOR_LOOKS: SampleLook<DoseCalculatorCardProps>[] = [
  {
    tag: 'Calc 1',
    title: 'By weight (most common)',
    line: AMOXICILLIN_LIQUID,
    props: {
      display: {
        look: 'byWeight',
        fields: [
          WEIGHT,
          field('rate', 'Rate', '25', 'mg/kg per dose'),
          field('dosesPerDay', 'Doses a day', '2', undefined, 'from twice daily'),
        ],
        result: {
          sentence: 'Take 9 mL by mouth twice daily for 10 days.',
          roundingNote: '9 mL = 720 mg, 17 mg (2%) over 703 mg',
          working: '28.12 kg × 25 mg/kg/dose = 703 mg → 9 mL = 720 mg (80 mg/mL)',
        },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 2',
    title: 'Chart or band',
    line: { medication: 'Ondansetron 4 mg ODT', unit: 'tablet', rest: 'by mouth every 8 hours as needed.' },
    props: {
      display: {
        look: 'band',
        weight: 'Weight 28.12 kg',
        bands: [
          { label: '8–15 kg', amount: '2 mg' },
          { label: '15–30 kg', amount: '4 mg' },
          { label: 'over 30 kg', amount: '8 mg' },
        ],
        current: 1,
        result: { sentence: 'Take 1 tablet by mouth every 8 hours as needed.' },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 3',
    title: 'Fixed dose',
    line: { medication: 'Amoxicillin 875 mg Tab', unit: 'tablet', rest: 'by mouth twice daily for 10 days.' },
    props: {
      display: {
        look: 'fixed',
        fields: [
          field('dose', 'Dose', '875', 'mg per dose'),
          field('dosesPerDay', 'Doses a day', '2', undefined, 'from twice daily'),
        ],
        result: {
          sentence: 'Take 1 tablet by mouth twice daily for 10 days.',
          working: '875 mg → 1 tablet = 875 mg (875 mg/tablet)',
        },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 4',
    title: 'Course',
    line: { medication: 'Azithromycin 200 mg/5 mL', unit: 'mL', rest: 'by mouth once daily for 1 day, then …' },
    props: {
      display: {
        look: 'course',
        fields: [
          WEIGHT,
          field('day1', 'Day 1', '10', 'mg/kg once'),
          field('days2to5', 'Days 2–5', '5', 'mg/kg once daily'),
        ],
        result: {
          sentence: 'Take 7 mL once on day 1, then 3.5 mL once daily for 4 days.',
          working: '28.12 kg × 10 mg/kg = 281.2 mg → 7 mL = 280 mg; 28.12 kg × 5 mg/kg = 140.6 mg → 3.5 mL = 140 mg',
        },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 5',
    title: 'Pack',
    line: { medication: 'methylPREDNISolone 4 mg Dosepak', unit: 'tablets', rest: 'by mouth …' },
    props: {
      display: {
        look: 'pack',
        steps: [6, 5, 4, 3, 2, 1].map((count, i) => ({
          label: `Day ${i + 1}`,
          amount: `${count} ${count === 1 ? 'tablet' : 'tablets'}`,
        })),
        result: { sentence: 'Take as directed on the pack for 6 days.' },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 6',
    title: 'Waiting for input',
    line: AMOXICILLIN_LIQUID,
    props: {
      display: {
        look: 'waiting',
        fields: [WEIGHT, field('rate', 'Rate', '', 'mg/kg per day', '(range 0.14–2 mg/kg/day)')],
        message: 'Enter a rate (range 0.14–2 mg/kg/day) to work out the dose',
      },
    },
  },
  {
    tag: 'Calc 7',
    title: 'No dose, with a reason',
    line: { medication: 'Clindamycin 75 mg/5 mL', unit: 'mL', rest: 'by mouth every 4 hours.' },
    props: {
      display: {
        look: 'noDose',
        reason: "No dose: the label's minimum 112.5 mg/day (37.5 mg × 3) is above the max 40 mg/kg/day at 2.4 kg.",
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 8',
    title: 'Enter my own (the order form today)',
    line: { medication: 'Amoxicillin 250 mg Cap', unit: 'capsules', rest: 'by mouth twice daily.' },
    props: {
      display: {
        look: 'own',
        fields: [
          WEIGHT,
          field('concentration', 'Strength', '250', 'mg per capsule'),
          field('rate', 'Rate', '25', 'mg/kg per dose'),
          field('dosesPerDay', 'Doses a day', '2', undefined, 'from twice daily'),
        ],
        result: {
          sentence: 'Take 3 capsules by mouth twice daily.',
          working: '28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg',
          roundingNote: '3 capsules = 750 mg, 47 mg (7%) over 703 mg',
        },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 9',
    title: 'Capped at a maximum',
    line: AMOXICILLIN_LIQUID,
    props: {
      display: {
        look: 'own',
        fields: [
          WEIGHT,
          field('concentration', 'Concentration', '80', 'mg per mL'),
          field('rate', 'Rate', '25', 'mg/kg per dose'),
          field('dosesPerDay', 'Doses a day', '2', undefined, 'from twice daily'),
          field('maxPerDose', 'Maximum per dose', '500', 'mg per dose'),
        ],
        result: {
          sentence: 'Take 6 mL by mouth twice daily for 10 days.',
          capNote: 'Capped at the 500 mg maximum (703 mg by weight)',
          working: '28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose → 6 mL = 480 mg',
          roundingNote:
            '6 mL = 480 mg, 20 mg (4%) under 500 mg (rounded down to stay at or under the max 500 mg per dose)',
        },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Overlay',
    title: 'Picker, warning boxes and source',
    line: AMOXICILLIN_LIQUID,
    props: {
      picker: regimen('AAP high-dose (acute otitis media)'),
      display: { look: 'fixed', result: { sentence: 'Take 14 mL by mouth twice daily for 10 days.' } },
      warnings: [
        { severity: 'error', lines: ['Contraindicated: in the label’s words.'] },
        { severity: 'warning', lines: ['Caution: in the source’s words.', 'Picked by hand for a patient outside it.'] },
      ],
      source: { label: 'AAP EQIPP dosage table', href: 'https://eqipp.aap.org/', extra: 'max 2 g/dose' },
      onUse: noop,
    },
  },
];

/** A prescription line over its maximum: the blank the warning points at is outlined, the warning under the sentence
 * has where the maximum came from behind its ⓘ. */
export interface MaximumWarningLook {
  tag: string;
  title: string;
  dose: string;
  frequency: string;
  warn: 'dose' | 'frequency';
  warning: DoseWarningBox;
  /** The quick pick's source, after the origin behind the ⓘ. */
  source?: { label: string; url?: string };
}

const FROM_QUICK_PICK = ['From the quick pick: Amox strep, twice daily'];

export const MAXIMUM_WARNING_LOOKS: MaximumWarningLook[] = [
  {
    tag: 'Warning 1',
    title: 'A typed dose above the per-dose maximum',
    dose: '10',
    frequency: 'twice daily',
    warn: 'dose',
    warning: {
      severity: 'warning',
      lines: ['800 mg per dose is above the 500 mg maximum.'],
      info: FROM_QUICK_PICK,
    },
    source: { label: 'Sample guideline', url: 'https://example.org/guideline' },
  },
  {
    tag: 'Warning 2',
    title: 'A new frequency takes the day over its maximum',
    dose: '6',
    frequency: 'four times daily',
    warn: 'frequency',
    warning: {
      severity: 'warning',
      lines: ['1,920 mg a day is above the 1,000 mg a day maximum.'],
      info: ['From the dose calculator'],
    },
  },
];
