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
  visitType: '',
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});

const labResults = FLOWSHEETS.find((f) => f.id === 'labResults') as FlowsheetDefinition;
const labelsOf = (visits: FlowsheetVisit[]): string[] =>
  rowsToShow(labResults, visits).map((row) => ('heading' in row ? `# ${row.heading}` : row.label));

describe('flowsheet list', () => {
  it('lists the flowsheets A to Z with Lab results first', () => {
    expect(FLOWSHEETS.map((f) => f.title)).toEqual(['Lab results', 'Newborn bilirubin', 'Thyroid', 'Vitals']);
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
      'HbA1c',
      '# Urinalysis',
      'Color',
      'Urine culture',
    ]);
  });

  it('hides a panel heading whose rows are all empty, and shows nothing for a patient with no results', () => {
    expect(labelsOf([visit({ hba1c: reading(5.6) })])).toEqual(['HbA1c']);
    expect(labelsOf([])).toEqual([]);
  });

  it('keeps every row of a flowsheet that does not hide empty rows, with no headings', () => {
    const vitals = FLOWSHEETS.find((f) => f.id === 'vitals') as FlowsheetDefinition;
    expect(rowsToShow(vitals, [])).toEqual(vitals.rows);
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
