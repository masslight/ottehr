// @vitest-environment jsdom
import { FlowsheetValue, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';
import { cellOf, toColumns } from '../../src/features/flowsheets/components/Flowsheets';

// The component imports the api client through its data hook; the formatting under test never calls it.
vi.mock('src/api/api', () => ({}));

const reading = (value: number | string, time = '2026-07-13T14:00:00.000Z'): FlowsheetValue => ({
  time,
  value,
  readings: [{ time, value }],
});

const visit = (values: Record<string, FlowsheetValue>): FlowsheetVisit => ({
  start: '2026-07-13T14:00:00.000Z',
  isFollowUp: false,
  visitType: '',
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values,
});

describe('flowsheet cell formatting', () => {
  it('shows exactly the row digits, keeping trailing zeros, in the cell and the hover readings', () => {
    const value: FlowsheetValue = {
      ...reading(3.1),
      readings: [
        { time: '2026-07-13T13:00:00.000Z', value: 3 },
        { time: '2026-07-13T14:00:00.000Z', value: 3.1 },
      ],
    };
    const cell = cellOf({ label: 'Weight (kg)', keys: ['weight'], digits: 2 }, visit({ weight: value }));
    expect(cell.text).toBe('3.10');
    expect(cell.history.map((h) => h.text)).toEqual(['3.00', '3.10']);
  });

  it('keeps one-decimal and integer rows as before', () => {
    expect(cellOf({ label: 'Weight (kg)', keys: ['weight'], digits: 1 }, visit({ weight: reading(3.1) })).text).toBe(
      '3.1'
    );
    expect(cellOf({ label: 'Weight (kg)', keys: ['weight'], digits: 1 }, visit({ weight: reading(3.14) })).text).toBe(
      '3.1'
    );
    expect(
      cellOf({ label: 'Heart rate (bpm)', keys: ['heartRate'], digits: 0 }, visit({ heartRate: reading(72.4) })).text
    ).toBe('72');
    expect(
      cellOf(
        { label: 'Blood pressure (mmHg)', keys: ['systolic', 'diastolic'], digits: 0 },
        visit({ systolic: reading(120), diastolic: reading(80) })
      ).text
    ).toBe('120/80');
  });

  it('shows text and unrounded numbers as saved', () => {
    expect(cellOf({ label: 'Drug', keys: ['drug'] }, visit({ drug: reading('warfarin 5 mg') })).text).toBe(
      'warfarin 5 mg'
    );
    expect(cellOf({ label: 'INR', keys: ['inr'] }, visit({ inr: reading(2.4) })).text).toBe('2.4');
  });
});

describe('flowsheet column labels', () => {
  it('marks an unlinked outside result and a follow-up in the column label', () => {
    const [outside, followUp, plain] = toColumns([
      { ...visit({}), start: '2026-07-15T09:00:00.000Z', isOutsideResult: true, visitType: 'Outside result' },
      { ...visit({}), start: '2026-07-14T09:00:00.000Z', isFollowUp: true },
      visit({}),
    ]);
    expect(outside.label).toMatch(/ \(outside result\)$/);
    expect(outside.url).toBeUndefined();
    expect(followUp.label).toMatch(/ \(follow-up\)$/);
    expect(plain.label).not.toMatch(/\(/);
  });
});
