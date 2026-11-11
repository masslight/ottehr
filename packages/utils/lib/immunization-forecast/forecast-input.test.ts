import { describe, expect, it } from 'vitest';
import { ImmunizationMark, PatientImmunizationRecord } from '../types/data/immunization/types';
import { forecastImmunizations } from './engine';
import { activeMarksByGroup, buildForecastInput, isoDateOf } from './forecast-input';

const dose = (overrides: Partial<PatientImmunizationRecord>): PatientImmunizationRecord => ({
  id: 'd',
  vaccineName: 'Vaccine',
  outside: false,
  dateUnknown: false,
  ...overrides,
});

const mark = (overrides: Partial<ImmunizationMark>): ImmunizationMark => ({
  id: 'm',
  vaccineGroup: { code: 'rota', display: 'Rotavirus' },
  mark: 'declined',
  markedAt: '2026-11-10T15:00:00.000Z',
  markedBy: { id: 'nurse-1', name: 'J. Nurse' },
  ...overrides,
});

describe('buildForecastInput', () => {
  it('turns records into engine doses: calendar dates, outside source code, undated kept as null', () => {
    const input = buildForecastInput(
      { dob: '2026-07-08', sex: 'female', asOf: '2026-11-10' },
      [
        dose({ id: 'here', cvx: '120', dateGiven: '2026-09-09T14:30:00.000Z' }),
        dose({
          id: 'out',
          cvx: '08',
          outside: true,
          dateGiven: '2026-07-08',
          sourceCode: '02',
          source: 'other-provider',
        }),
        dose({ id: 'undated', cvx: '03', outside: true, dateUnknown: true, sourceCode: '01', source: 'unspecified' }),
        dose({ id: 'no-cvx', dateGiven: '2026-10-01T09:00:00.000Z' }),
      ],
      []
    );
    expect(input.dob).toBe('2026-07-08');
    expect(input.sex).toBe('female');
    expect(input.asOf).toBe('2026-11-10');
    expect(input.doses).toEqual([
      { id: 'here', date: '2026-09-09', cvx: '120', source: 'administered' },
      { id: 'out', date: '2026-07-08', cvx: '08', source: 'outside', outsideSource: '02' },
      { id: 'undated', date: null, cvx: '03', source: 'outside', outsideSource: '01' },
      { id: 'no-cvx', date: '2026-10-01', cvx: '', source: 'administered' },
    ]);
  });

  it('passes only the active marks, newest first wins, cleared and unknown groups ignored', () => {
    const marks = [
      mark({ id: 'newest', note: 'Parent declined' }),
      mark({ id: 'cleared', mark: 'immune', cleared: { at: '2026-11-01T00:00:00.000Z', by: { name: 'Dr. Patel' } } }),
      mark({ id: 'older', vaccineGroup: { code: 'rota', display: 'Rotavirus' }, markedAt: '2026-10-01T00:00:00.000Z' }),
      mark({ id: 'unknown', vaccineGroup: { code: 'travel', display: 'Travel' } }),
      mark({ id: 'hepb', vaccineGroup: { code: 'hepb', display: 'Hep B' }, mark: 'contraindicated' }),
    ];
    expect(Object.keys(activeMarksByGroup(marks)).sort()).toEqual(['hepb', 'rota']);
    const input = buildForecastInput({ dob: '2026-07-08', asOf: '2026-11-10' }, [], marks);
    expect(input.marks).toEqual({
      rota: { type: 'declined', date: '2026-11-10', by: 'J. Nurse', note: 'Parent declined' },
      hepb: { type: 'contraindicated', date: '2026-11-10', by: 'J. Nurse' },
    });
  });

  it('takes the calendar day in the visit zone, not the UTC day: 10:30 pm in New York is still that day', () => {
    const tz = 'America/New_York';
    const input = buildForecastInput(
      { dob: '2026-07-08', asOf: '2026-11-10' },
      [dose({ id: 'late', cvx: '08', dateGiven: '2026-08-11T02:30:00.000Z' })],
      [mark({ markedAt: '2026-11-11T03:30:00.000Z' })],
      tz
    );
    expect(input.doses[0].date).toBe('2026-08-10');
    expect(input.marks?.rota?.date).toBe('2026-11-10');
    // without a zone the value's own offset decides; a plain date stays itself
    expect(isoDateOf('2026-08-11T02:30:00.000Z')).toBe('2026-08-11');
    expect(isoDateOf('2026-08-10T22:30:00.000-04:00')).toBe('2026-08-10');
    expect(isoDateOf('2026-10-01', tz)).toBe('2026-10-01');
    expect(isoDateOf('not a date')).toBeUndefined();
  });

  it('produces input the engine accepts: a declined mark overrides the group status', () => {
    const forecast = forecastImmunizations(
      buildForecastInput({ dob: '2026-07-08', asOf: '2026-11-10' }, [], [mark({})])
    );
    expect(forecast.groups.find((group) => group.group === 'rota')?.status).toBe('declined');
    expect(forecast.groups.find((group) => group.group === 'hepb')?.status).toBe('pastdue');
  });
});
