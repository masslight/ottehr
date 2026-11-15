// @vitest-environment jsdom
import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { cellOf, rowsToShow } from '../../src/features/flowsheets/components/Flowsheets';
import { FlowsheetDefinition, FLOWSHEETS } from '../../src/features/flowsheets/registry';

// The component imports the api client through its data hook; the row logic under test never calls it.
vi.mock('src/api/api', () => ({}));

const reading = (value: number | string, note?: string): FlowsheetValue => {
  const time = '2026-07-13T14:00:00.000Z';
  return { time, value, note, readings: [{ time, value, note }] };
};

const visit = (values: Record<string, FlowsheetValue>): FlowsheetVisit => ({
  start: '2026-07-13T14:00:00.000Z',
  isFollowUp: false,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});

const labResults = FLOWSHEETS.find((f) => f.id === 'labResults') as FlowsheetDefinition;
const labelsOf = (visits: FlowsheetVisit[]): string[] =>
  rowsToShow(labResults, visits).map((row) => ('heading' in row ? `# ${row.heading}` : row.label));

describe('flowsheet list', () => {
  it('lists the flowsheets A to Z', () => {
    expect(FLOWSHEETS.map((f) => f.title)).toEqual(['Growth', 'Lab results', 'Newborn bilirubin', 'Thyroid', 'Vitals']);
  });
});

describe('Lab results rows', () => {
  it('shows only the rows the patient has a result for, under their panel headings, in the requirements’ order', () => {
    const visits = [
      visit({ hemoglobin: reading(13.1), creatinine: reading(0.9), uaColor: reading('Yellow') }),
      visit({ platelets: reading(250), hba1c: reading(5.6), urineCulture: reading('No growth') }),
    ];
    expect(labelsOf(visits)).toEqual([
      '# CBC',
      'Hemoglobin',
      'Platelets',
      '# CMP/BMP',
      'Creatinine',
      '# Urinalysis',
      'Color',
      '# Other tests',
      'HbA1c',
      'Urine culture',
    ]);
  });

  it('puts every test outside a panel under one "Other tests" heading, last; every row in order', () => {
    const values = Object.fromEntries(labResults.rows.map((row) => [row.keys[0], reading(1)]));
    expect(labelsOf([visit(values)])).toEqual([
      '# CBC',
      'Hemoglobin',
      'Hematocrit',
      'MCV',
      'MCH',
      'MCHC',
      'RBC',
      'WBC',
      'Platelets',
      'Neutrophils (%)',
      'Lymphocytes (%)',
      'Monocytes (%)',
      'Eosinophils (%)',
      'Basophils (%)',
      'Neutrophils (absolute)',
      'Lymphocytes (absolute)',
      '# CMP/BMP',
      'Glucose',
      'BUN',
      'Creatinine',
      'eGFR',
      'BUN/Creatinine ratio',
      'Sodium',
      'Potassium',
      'Chloride',
      'Bicarbonate (CO2)',
      'Calcium',
      '# CMP',
      'Total protein',
      'Albumin',
      'Globulin',
      'Albumin/Globulin ratio',
      'Total bilirubin',
      'Alkaline phosphatase',
      'AST',
      'ALT',
      '# Lipid panel',
      'Total cholesterol',
      'LDL cholesterol',
      'HDL cholesterol',
      'Triglycerides',
      'Non-HDL cholesterol',
      '# Thyroid',
      'TSH',
      'Free T4',
      'Total T4',
      'Free T3',
      'Total T3',
      'TPO antibodies',
      '# Iron panel',
      'Iron',
      'TIBC',
      'Transferrin saturation',
      'Ferritin',
      '# Urinalysis',
      'Color',
      'Appearance',
      'Specific gravity',
      'pH',
      'Protein',
      'Glucose',
      'Ketones',
      'Bilirubin',
      'Blood',
      'Nitrite',
      'Leukocyte esterase',
      'Urobilinogen',
      '# Other tests',
      'HbA1c',
      'Vitamin D, 25-hydroxy',
      'Vitamin B12',
      'Urine albumin/creatinine ratio',
      'PSA',
      'Magnesium',
      'CRP',
      'hs-CRP',
      'Urine culture',
      'HIV Ag/Ab',
      'Hepatitis C antibody',
      'ESR',
      'Uric acid',
      'Folate',
      'Testosterone, total',
      'Urine pregnancy (hCG)',
      'PTH',
      'Phosphorus',
    ]);
  });

  it('hides a panel heading whose rows are all empty, and shows nothing for a patient with no results', () => {
    expect(labelsOf([visit({ hba1c: reading(5.6) })])).toEqual(['# Other tests', 'HbA1c']);
    expect(labelsOf([])).toEqual([]);
  });

  it('keeps every row of a flowsheet that does not hide empty rows (but its hideWhenEmpty rows), with no headings', () => {
    const vitals = FLOWSHEETS.find((f) => f.id === 'vitals') as FlowsheetDefinition;
    expect(rowsToShow(vitals, [])).toEqual(vitals.rows.filter((row) => !row.hideWhenEmpty));
  });

  it('appends the fasting note after the value and unit, in the cell and the hover readings', () => {
    const glucose: FlowsheetValue = {
      ...reading(92, 'fasting'),
      unit: 'mg/dL',
      readings: [
        { time: '2026-07-13T08:00:00.000Z', value: 92, unit: 'mg/dL', note: 'fasting' },
        { time: '2026-07-13T14:00:00.000Z', value: 140, unit: 'mg/dL' },
      ],
    };
    const cell = cellOf({ label: 'Glucose', keys: ['glucose'] }, visit({ glucose }));
    expect(cell.text).toBe('92 mg/dL (fasting)');
    expect(cell.history.map((h) => h.text)).toEqual(['92 mg/dL (fasting)', '140 mg/dL']);
  });
});

describe('Vitals rows', () => {
  const vitals = FLOWSHEETS.find((f) => f.id === 'vitals') as FlowsheetDefinition;
  const labels = (visits: FlowsheetVisit[]): string[] =>
    rowsToShow(vitals, visits).map((row) => ('heading' in row ? `# ${row.heading}` : row.label));

  it('no BMI row when no visit shown has a BMI (a baby under 2)', () => {
    expect(labels([visit({ weight: reading(5.8) })])).toEqual([
      'Temperature (°C)',
      'Heart rate (/min)',
      'Respiratory rate (/min)',
      'SpO₂ (%)',
      'Blood pressure (mm Hg)',
      'Weight (kg)',
      'Height (cm)',
    ]);
    expect(labels([visit({ weight: reading(60) }), visit({ bmi: reading(22.1) })])).toContain('BMI (kg/m²)');
  });

  it('no Head circumference row when no visit shown has one (an adult)', () => {
    expect(labels([visit({ weight: reading(60) })])).not.toContain('Head circumference (cm)');
    expect(labels([visit({ weight: reading(5.8) }), visit({ headCircumference: reading(40.2) })])).toContain(
      'Head circumference (cm)'
    );
  });
});

describe('Thyroid rows', () => {
  const thyroid = FLOWSHEETS.find((f) => f.id === 'thyroid') as FlowsheetDefinition;
  const labels = (visits: FlowsheetVisit[]): string[] =>
    rowsToShow(thyroid, visits).map((row) => ('heading' in row ? `# ${row.heading}` : row.label));

  it('the less common tests show only when a visit shown has one; the rest always show', () => {
    expect(labels([visit({ tsh: reading(2.1) })])).toEqual([
      'TSH',
      'Free T4',
      'Thyroid medication',
      'Thyroid diagnosis this visit',
      'Weight (kg)',
      'Heart rate (/min)',
    ]);
    expect(labels([visit({ totalT3: reading(110) }), visit({ tpoAntibodies: reading(35) })])).toEqual(
      expect.arrayContaining(['Total T3', 'TPO antibodies'])
    );
  });
});
