import { SuggestedSentence } from 'src/components/SuggestedSentences';
import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';
import { DoseCalculatorCardProps, DoseField } from './DoseCalculatorCard';
import { ErxSuggestionsBoxProps } from './ErxSuggestionsBox';

/** Every look with the catalogue's sample props (a 10-year-old, 28.12 kg, unless a look says otherwise), for the
 * local preview page and the component tests. Display strings only: nothing here is dosing data. */

export interface SampleLook<P> {
  tag: string;
  title: string;
  props: P;
}

const noop = (): void => undefined;

const diagnosisBlank = (title: string, initial?: string): SentenceBlank => ({
  title,
  options: ['Acute otitis media, unspecified H66.90', 'Acute obstructive laryngitis [croup] J05.0'],
  initial,
  optional: true,
});

type RowsProps = Extract<ErxSuggestionsBoxProps<SuggestedSentence>, { look: 'rows' }>;

const rows = (...list: Omit<SuggestedSentence, 'id'>[]): RowsProps => ({
  look: 'rows',
  rows: list.map((row, i) => ({ id: String(i), ...row })),
  onPick: noop,
  onOther: noop,
});

export const SUGGESTION_LOOKS: SampleLook<ErxSuggestionsBoxProps<SuggestedSentence>>[] = [
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

const WEIGHT: DoseField = { id: 'weight', label: 'Weight', value: '28.12', unit: 'kg', from: 'this visit' };
const concentration = (value: string): DoseField => ({
  id: 'concentration',
  label: 'Concentration',
  value,
  unit: 'mg/mL',
  from: 'from the product',
});
const rate = (value: string, unit: string, from?: string): DoseField => ({
  id: 'rate',
  label: 'Rate',
  value,
  unit,
  from,
});
const dosesPerDay = (value: string, from?: string): DoseField => ({
  id: 'dosesPerDay',
  label: 'Doses a day',
  value,
  from,
});
const regimen = (value: string, title = 'Regimen'): DoseCalculatorCardProps['picker'] => ({
  title,
  options: [value, 'Enter my own'],
  value,
  onChange: noop,
});

export const CALCULATOR_LOOKS: SampleLook<DoseCalculatorCardProps>[] = [
  {
    tag: 'Calc 1',
    title: 'By weight (most common)',
    props: {
      picker: regimen('AAP high-dose (acute otitis media)'),
      display: {
        look: 'byWeight',
        fields: [
          WEIGHT,
          concentration('80'),
          rate('80', 'mg/kg per day', '(low end of the range 80–90 mg/kg/day)'),
          dosesPerDay('2', 'from the regimen'),
        ],
        result: {
          amount: '14 mL',
          frequency: 'twice daily',
          working: '28.12 kg × 80 mg/kg/day ÷ 2 = 1124.8 mg → 14 mL = 1120 mg',
          roundingNote: '14 mL = 1120 mg, 4.8 mg (0%) under 1124.8 mg',
        },
      },
      source: { label: 'AAP EQIPP dosage table', href: 'https://eqipp.aap.org/', extra: 'max 2 g/dose' },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 2',
    title: 'Chart or band',
    props: {
      picker: regimen("OTC Drug Facts weight/age chart (Children's Motrin)"),
      display: {
        look: 'band',
        band: { label: '60–71 lb, 9–10 years', amount: '12.5 mL', rest: 'every 6 to 8 hours as needed' },
        result: { amount: '12.5 mL', frequency: 'every 6 to 8 hours' },
      },
      source: { label: "Children's Motrin Drug Facts" },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 3',
    title: 'Fixed dose',
    props: {
      picker: regimen('Adults and adolescents (13 years and older), early Lyme disease'),
      display: {
        look: 'fixed',
        result: {
          amount: '2 tablets',
          frequency: 'twice daily for 20 days',
          working: '500 mg → 2 tablets = 500 mg (250 mg/tablet)',
        },
      },
      source: { label: 'cefuroxime axetil tablets label' },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 4',
    title: 'Course',
    props: {
      picker: regimen('AOM / CAP 5-day (10 then 5)'),
      display: {
        look: 'course',
        steps: [
          { label: 'Day 1', amount: '7 mL', rest: 'once daily (10 mg/kg)' },
          { label: 'Days 2–5', amount: '3.5 mL', rest: 'once daily (5 mg/kg)' },
        ],
      },
      source: { label: 'Zithromax label' },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 5',
    title: 'Pack',
    props: {
      picker: regimen('Medrol 4 mg Dosepak', 'Product'),
      display: {
        look: 'pack',
        steps: [
          { label: 'Day 1', amount: '6 tablets' },
          { label: 'Day 2', amount: '5 tablets' },
          { label: '… down to day 6', amount: '1 tablet' },
        ],
      },
      source: { label: 'Medrol Dosepak label' },
    },
  },
  {
    tag: 'Calc 6',
    title: 'Waiting for input',
    props: {
      picker: regimen('Label general pediatric range'),
      display: {
        look: 'waiting',
        fields: [rate('', 'mg/kg per day', '(range 0.14–2 mg/kg/day)')],
        message: 'Enter a rate (range 0.14–2 mg/kg/day) to work out the dose',
      },
    },
  },
  {
    tag: 'Calc 7',
    title: 'No dose, with a reason',
    props: {
      picker: regimen('IDSA MRSA skin/soft tissue (pediatric)'),
      display: {
        look: 'noDose',
        reason: "No dose: the label's minimum 112.5 mg/day (37.5 mg × 3) is above the max 40 mg/kg/day at 2.4 kg.",
      },
      source: { label: 'clindamycin label; IDSA 2011' },
      onUse: noop,
    },
  },
  {
    tag: 'Calc 8',
    title: 'Plain calculator',
    props: {
      picker: regimen('Enter my own'),
      display: {
        look: 'own',
        fields: [
          WEIGHT,
          { ...concentration('250'), label: 'Strength', unit: 'mg per capsule' },
          rate('25', 'mg/kg per dose'),
          dosesPerDay('2'),
        ],
        result: {
          amount: '3 capsules',
          frequency: 'twice daily',
          working: '28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg',
          roundingNote: '3 capsules = 750 mg, 47 mg (7%) over 703 mg',
        },
      },
      onUse: noop,
    },
  },
  {
    tag: 'Overlay',
    title: 'Red and orange warning boxes',
    props: {
      picker: regimen('AAP high-dose (acute otitis media)'),
      display: { look: 'fixed', result: { amount: '14 mL', frequency: 'twice daily' } },
      warnings: [
        { severity: 'error', lines: ['Contraindicated: in the label’s words.'] },
        { severity: 'warning', lines: ['Caution: in the source’s words.', 'Picked by hand for a patient outside it.'] },
      ],
    },
  },
];
