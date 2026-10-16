import type { FetchStepStats } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import {
  chooseFetchMode,
  DIRECT_FETCH_MAX_SECONDS,
  isDirectTimeout,
  measuredFetch,
  rangeDays,
  stepDensity,
} from './fetchMode';

const days = (n: number): { start: string; end: string } => ({
  start: '2026-09-01T04:00:00.000Z',
  end: new Date(Date.parse('2026-09-01T04:00:00.000Z') + n * 86_400_000 - 1).toISOString(),
});

describe('chooseFetchMode', () => {
  it('goes direct for a direct report on a range no wider than the measured one', () => {
    const report = { fetchMode: 'direct' as const, measuredRangeDays: 30 };
    expect(chooseFetchMode(report, days(30))).toBe('direct');
    expect(chooseFetchMode(report, days(7))).toBe('direct');
  });

  it('uses the Task for a wider range than measured', () => {
    expect(chooseFetchMode({ fetchMode: 'direct', measuredRangeDays: 30 }, days(31))).toBe('task');
    expect(chooseFetchMode({ fetchMode: 'direct', measuredRangeDays: 30 }, days(365))).toBe('task');
  });

  it('uses the Task when the report says task or was never measured', () => {
    expect(chooseFetchMode({ fetchMode: 'task', measuredRangeDays: 30 }, days(7))).toBe('task');
    expect(chooseFetchMode({}, days(7))).toBe('task');
    expect(chooseFetchMode({ fetchMode: 'direct' }, days(7))).toBe('task');
  });

  it('rounds the span to whole days (a DST shift does not change it)', () => {
    expect(rangeDays(days(30))).toBe(30);
    expect(rangeDays({ start: '2026-10-05T04:00:00.000Z', end: '2026-11-04T04:59:59.999Z' })).toBe(30);
    expect(rangeDays(days(1))).toBe(1);
  });
});

describe('measuredFetch', () => {
  it('marks a fast fetch direct and a slow one task, with the span it ran on', () => {
    expect(measuredFetch(DIRECT_FETCH_MAX_SECONDS * 1000 - 1, days(30))).toEqual({
      fetchMode: 'direct',
      measuredFetchSeconds: 9.999,
      measuredRangeDays: 30,
    });
    expect(measuredFetch(DIRECT_FETCH_MAX_SECONDS * 1000, days(90)).fetchMode).toBe('task');
  });

  it('pins the Task path after a direct timeout however fast the retry was', () => {
    expect(measuredFetch(500, days(1), true).fetchMode).toBe('task');
  });
});

describe('isDirectTimeout', () => {
  it('is a gateway failure or any failure after most of the 27 s ceiling', () => {
    expect(isDirectTimeout({ status: 504 }, 1000)).toBe(true);
    expect(isDirectTimeout({ status: 0 }, 21_000)).toBe(true);
    expect(isDirectTimeout(new Error('Failed to fetch'), 26_000)).toBe(true);
  });

  it('is not an ordinary error early in the call', () => {
    expect(isDirectTimeout({ status: 400 }, 1000)).toBe(false);
    expect(isDirectTimeout({ status: 500 }, 1000)).toBe(false);
    expect(isDirectTimeout({ status: 0 }, 1000)).toBe(false);
  });
});

describe('stepDensity', () => {
  const plan = {
    steps: [
      {
        id: 'visits',
        params: [
          { name: 'date', value: 'ge{{start}}' },
          { name: 'date', value: 'le{{end}}' },
        ],
      },
      { id: 'vitals', params: [], from: { step: 'visits' } },
      { id: 'locations', params: [], from: { step: 'visits' } },
      { id: 'open', params: [{ name: 'date', value: 'ge{{start}}' }] },
      {
        id: 'small',
        params: [
          { name: 'date', value: 'ge{{start}}' },
          { name: 'date', value: 'le{{end}}' },
        ],
      },
    ],
  };
  const stat = (partial: Partial<FetchStepStats> & Pick<FetchStepStats, 'id' | 'resourceType'>): FetchStepStats => ({
    ms: 1,
    count: 0,
    byType: {},
    bytes: 0,
    mode: 'bulk',
    requests: 1,
    params: [],
    ...partial,
  });

  it('measures primary resources per day for a date-bounded step and per id for a scoped one, bulk or paged', () => {
    const stats = [
      stat({ id: 'visits', resourceType: 'Appointment', byType: { Appointment: 3000, Patient: 2500 } }),
      stat({ id: 'vitals', resourceType: 'Observation', byType: { Observation: 19_500 }, scopedValues: 3000 }),
      // Ten locations across the 3,000 visits: the ids a scoped step is fed are not one per source record.
      stat({ id: 'locations', resourceType: 'Location', byType: { Location: 10 }, scopedValues: 10 }),
      stat({ id: 'small', resourceType: 'Appointment', byType: { Appointment: 300 }, mode: 'normal' }),
    ];
    expect(stepDensity(plan, stats, days(30))).toEqual({
      // 3,000 visits brought 2,500 patients along: 5,500 rows for 3,000 records
      visits: { recordsPerDay: 100, rowsPerRecord: 5500 / 3000 },
      vitals: { recordsPerId: 6.5, idsPerSourceRecord: 1 },
      locations: { recordsPerId: 1, idsPerSourceRecord: 10 / 3000 },
      small: { recordsPerDay: 10, rowsPerRecord: 1 },
    });
  });

  it('leaves the ids per source record out when the source step measured nothing', () => {
    const stats = [
      stat({ id: 'vitals', resourceType: 'Observation', byType: { Observation: 19_500 }, scopedValues: 3000 }),
    ];
    expect(stepDensity(plan, stats, days(30))).toEqual({ vitals: { recordsPerId: 6.5 } });
  });

  it('learns nothing from a failed, skipped or half-bounded step', () => {
    const stats = [
      stat({ id: 'small', resourceType: 'Appointment', byType: {}, mode: 'skipped' }),
      stat({ id: 'visits', resourceType: 'Appointment', byType: { Appointment: 3000 }, error: 'boom' }),
      stat({ id: 'open', resourceType: 'Appointment', byType: { Appointment: 3000 } }),
    ];
    expect(stepDensity(plan, stats, days(30))).toEqual({});
  });

  it('treats a range under a day as one day', () => {
    const stats = [stat({ id: 'visits', resourceType: 'Appointment', byType: { Appointment: 40 } })];
    expect(stepDensity(plan, stats, days(1))).toEqual({ visits: { recordsPerDay: 40, rowsPerRecord: 1 } });
  });
});
