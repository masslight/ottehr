import { EvaluatedDose, ImmunizationForecast, ImmunizationGroupForecast } from 'utils/lib/immunization-forecast/types';
import { ImmunizationMark } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import {
  ageInMonths,
  defaultRange,
  doseLabelMonths,
  formatAge,
  givenDoseWindowSegments,
  lastProjectedMonths,
  markHistoryText,
  nextDoseSegments,
  projectedDoseSegments,
  projectedDoseText,
  sameShotText,
  timelineRanges,
  timelineTicks,
  windowText,
  xPercent,
} from '../../src/features/immunization/timeline/timelineModel';

const DOB = '2026-07-08';

const group = (overrides: Partial<ImmunizationGroupForecast>): ImmunizationGroupForecast => ({
  group: 'dtap',
  label: 'DTaP/Tdap/Td',
  status: 'due',
  seriesStatus: 'Not Complete',
  seriesNames: [],
  targetDoses: 5,
  targetText: '5',
  doses: [],
  next: null,
  notNeeded: [],
  notes: [],
  ...overrides,
});

describe('timeline axis', () => {
  it('places birth at 0 %, the range end at 100 % and stretches infancy', () => {
    expect(xPercent(0, 24)).toBe(0);
    expect(xPercent(24, 24)).toBe(100);
    expect(xPercent(2, 24)).toBeGreaterThan(25);
    expect(xPercent(-1, 24)).toBe(0);
    expect(xPercent(30, 24)).toBe(100);
  });

  it('measures age in months from two ISO dates', () => {
    expect(ageInMonths(DOB, '2026-09-08')).toBe(2);
    expect(ageInMonths(DOB, '2026-07-08T15:00:00.000Z')).toBe(0);
    expect(formatAge(0)).toBe('birth');
    expect(formatAge(4.05)).toBe('4 mo');
    expect(formatAge(4.25)).toBe('4.3 mo');
    expect(formatAge(48)).toBe('4 y');
  });

  it('offers the childhood ranges, plus an adult range reaching past an adult patient', () => {
    expect(timelineRanges(4).map((range) => range.label)).toEqual(['0–2 y', '0–7 y', '0–18 y']);
    expect(timelineRanges(44 * 12).map((range) => range.label)).toEqual(['0–2 y', '0–7 y', '0–18 y', '0–50 y']);
    expect(defaultRange(4, timelineRanges(4)).label).toBe('0–2 y');
    expect(defaultRange(60, timelineRanges(60)).label).toBe('0–7 y');
    expect(defaultRange(44 * 12, timelineRanges(44 * 12)).label).toBe('0–50 y');
  });

  it('thins the ticks on wide ranges and adds decades for adults', () => {
    expect(timelineTicks(24).map((tick) => tick.label)).toEqual([
      'Birth',
      '2m',
      '4m',
      '6m',
      '9m',
      '12m',
      '15m',
      '18m',
      '2y',
    ]);
    expect(timelineTicks(216).map((tick) => tick.label)).not.toContain('9m');
    expect(timelineTicks(600).map((tick) => tick.label)).toEqual(
      expect.arrayContaining(['18y', '20y', '30y', '40y', '50y'])
    );
  });
});

describe('next dose bar', () => {
  it('says in one short line what each part of the bar means', () => {
    const [early, recommended, pastDue] = nextDoseSegments(
      group({
        status: 'pastdue',
        next: { n: 2, earliest: '2026-09-05', recommended: '2026-11-08', pastDue: '2026-12-08', latest: null, cvx: [] },
      }),
      DOB,
      '2027-01-08',
      24
    );
    expect(early.tip).toBe('DTaP/Tdap/Td dose 2 early window: 09/05/2026 – 11/07/2026');
    expect(recommended.tip).toBe('DTaP/Tdap/Td dose 2 window: 11/08/2026 – 12/07/2026');
    expect(pastDue.tip).toBe('DTaP/Tdap/Td dose 2 past due since 12/08/2026');
    const seasonal = nextDoseSegments(
      group({
        next: { n: 1, earliest: '2026-09-05', recommended: '2026-11-08', pastDue: null, latest: null, cvx: [] },
      }),
      DOB,
      '2026-11-10',
      24
    );
    expect(seasonal[1].tip).toBe('DTaP/Tdap/Td dose 1 window: from 11/08/2026');
  });

  const next = {
    n: 2,
    earliest: '2026-09-05',
    recommended: '2026-11-08',
    pastDue: '2026-12-08',
    latest: null,
    cvx: [],
  };

  it('runs earliest → recommended → past due, with a past-due segment up to today when late', () => {
    const segments = nextDoseSegments(group({ status: 'pastdue', next }), DOB, '2027-01-08', 24);
    expect(segments.map((segment) => segment.kind)).toEqual(['earliest', 'recommended', 'pastdue']);
    expect(segments[0].from).toBeCloseTo(ageInMonths(DOB, next.earliest));
    expect(segments[1].to).toBeCloseTo(ageInMonths(DOB, next.pastDue));
    expect(segments[2].to).toBeCloseTo(6);
    expect(segments[0].title).toBe('Dose 2: earliest 09/05/2026');
  });

  it('has no past-due segment before the past-due date and none at all for seasonal doses', () => {
    expect(nextDoseSegments(group({ next }), DOB, '2026-11-10', 24).map((s) => s.kind)).toEqual([
      'earliest',
      'recommended',
    ]);
    const seasonal = nextDoseSegments(group({ next: { ...next, pastDue: null } }), DOB, '2027-06-01', 24);
    expect(seasonal.map((s) => s.kind)).toEqual(['earliest', 'recommended']);
    expect(seasonal[1].to).toBe(24);
  });

  it('draws nothing for complete, immune or contraindicated lanes, and clips to the range', () => {
    expect(nextDoseSegments(group({ status: 'complete', next }), DOB, '2026-11-10', 24)).toEqual([]);
    expect(nextDoseSegments(group({ status: 'immune', next }), DOB, '2026-11-10', 24)).toEqual([]);
    const beyond = { ...next, earliest: '2030-07-08', recommended: '2030-07-08', pastDue: '2031-07-08' };
    expect(nextDoseSegments(group({ next: beyond }), DOB, '2026-11-10', 24)).toEqual([]);
  });
});

describe('projected later doses', () => {
  const polio4 = { n: 4, earliest: '2030-07-08', recommended: '2030-07-08', pastDue: '2033-08-04' };
  const dtap4 = { n: 4, earliest: '2027-07-08', recommended: '2027-10-08', pastDue: '2028-01-08' };

  it('stretches the default range to the last projected recommended date, at most five years past today', () => {
    expect(lastProjectedMonths(undefined, DOB)).toBe(0);
    expect(lastProjectedMonths({ ipv: [polio4], dtap: [dtap4] }, DOB)).toBeCloseTo(48);
    expect(defaultRange(4, timelineRanges(4), 48).label).toBe('0–7 y');
    expect(defaultRange(4, timelineRanges(4), 15).label).toBe('0–2 y');
    // an HPV dose at 11 years is out of reach for an infant: the range stops at today + 5 years
    expect(defaultRange(4, timelineRanges(4), 132).label).toBe('0–7 y');
  });

  it('draws allowed but early, then one outline window ending at the past-due date', () => {
    const segments = projectedDoseSegments(dtap4, 'DTaP/Tdap/Td', DOB, 84);
    expect(segments.map((segment) => segment.tip)).toEqual([
      'DTaP/Tdap/Td dose 4 early window: 07/08/2027 – 10/07/2027',
      'DTaP/Tdap/Td dose 4 window: 10/08/2027 – 01/07/2028',
    ]);
    expect(segments.map((segment) => segment.kind)).toEqual(['projected-earliest', 'projected-recommended']);
    expect(segments[1].to).toBeCloseTo(ageInMonths(DOB, dtap4.pastDue));
    expect(segments[0].title).toBe(
      'DTaP/Tdap/Td dose 4 (projected): recommended 10/08/2027, past due after 01/08/2028, if dose 3 is given on time.'
    );
    // same earliest and recommended: no allowed-but-early part; beyond the range: clipped away
    expect(projectedDoseSegments(polio4, 'Polio', DOB, 84).map((segment) => segment.kind)).toEqual([
      'projected-recommended',
    ]);
    expect(projectedDoseSegments(polio4, 'Polio', DOB, 24)).toEqual([]);
    // the dose number sits at the start of the recommended part, and nowhere when that part is off the range
    expect(doseLabelMonths(segments)).toBeCloseTo(ageInMonths(DOB, dtap4.recommended));
    expect(doseLabelMonths(projectedDoseSegments(polio4, 'Polio', DOB, 24))).toBeNull();
    expect(projectedDoseText('Polio', { ...polio4, pastDue: null })).toBe(
      'Polio dose 4 (projected): recommended 07/08/2030, if dose 3 is given on time.'
    );
  });
});

describe('windows of given doses', () => {
  const dose: EvaluatedDose = {
    id: 'd2',
    date: '2026-12-20',
    cvx: '120',
    doseNumber: 2,
    status: 'valid',
    counted: true,
    window: { earliest: '2026-09-05', recommended: '2026-11-08', pastDue: '2026-12-08' },
    timing: 'late',
  };

  it('says on hover when the dose was given and how it was timed', () => {
    const [early, recommended] = givenDoseWindowSegments(dose, DOB, 24, 'DTaP');
    expect(early.tip).toBe('DTaP dose 2 given 12/20/2026 (late)');
    expect(recommended.tip).toBe('DTaP dose 2 given 12/20/2026 (late)');
    expect(givenDoseWindowSegments({ ...dose, timing: 'on-time' }, DOB, 24, 'DTaP')[0].tip).toBe(
      'DTaP dose 2 given 12/20/2026 (on time)'
    );
  });

  it('is two bands, the second red when the dose was late, with the window and timing in the title', () => {
    const segments = givenDoseWindowSegments(dose, DOB, 24, 'DTaP');
    expect(segments.map((segment) => [segment.kind, segment.late ?? false])).toEqual([
      ['window-earliest', false],
      ['window-recommended', true],
    ]);
    expect(segments[0].title).toBe(
      'DTaP dose 2 window: earliest 09/05/2026 · recommended 11/08/2026 · past due after 12/08/2026. Given late at 5.4 mo.'
    );
  });

  it('is nothing for undated or uncounted doses, and skips the earliest band when it equals recommended', () => {
    expect(givenDoseWindowSegments({ ...dose, date: null }, DOB, 24, 'DTaP')).toEqual([]);
    expect(givenDoseWindowSegments({ ...dose, window: undefined }, DOB, 24, 'DTaP')).toEqual([]);
    const sameStart = { ...dose, window: { earliest: '2026-11-08', recommended: '2026-11-08', pastDue: '2026-12-08' } };
    expect(givenDoseWindowSegments(sameStart, DOB, 24, 'DTaP').map((s) => s.kind)).toEqual(['window-recommended']);
    expect(windowText(sameStart.window)).toBe('recommended 11/08/2026 · past due after 12/08/2026');
  });
});

describe('detail texts', () => {
  it('writes the mark history with who cleared it', () => {
    const marks: ImmunizationMark[] = [
      {
        id: 'm2',
        vaccineGroup: { code: 'rota', display: 'Rotavirus' },
        mark: 'declined',
        markedAt: '2026-11-10T15:00:00.000Z',
        markedBy: { name: 'J. Nurse' },
        cleared: { at: '2026-12-08T15:00:00.000Z', by: { name: 'Dr. Patel' } },
      },
      {
        id: 'other',
        vaccineGroup: { code: 'hepb', display: 'Hep B' },
        mark: 'immune',
        markedAt: '2026-11-10T15:00:00.000Z',
        markedBy: { name: 'X' },
      },
    ];
    expect(markHistoryText(marks, 'rota')).toBe(
      'Declined 11/10/2026 · recorded by J. Nurse, cleared 12/08/2026 by Dr. Patel'
    );
    expect(markHistoryText(marks, 'var')).toBe('');
    // a blank name drops the "by" parts
    const unnamed = [
      { ...marks[0], markedBy: { name: ' ' }, cleared: { at: '2026-12-08T15:00:00.000Z', by: { name: '' } } },
    ];
    expect(markHistoryText(unnamed, 'rota')).toBe('Declined 11/10/2026, cleared 12/08/2026');
  });

  it('names the other lanes a combination shot counted in', () => {
    const shot = {
      id: 'pentacel-1',
      date: '2026-09-09',
      cvx: '120',
      doseNumber: 1,
      status: 'valid' as const,
      counted: true,
    };
    const forecast: ImmunizationForecast = {
      asOf: '2026-11-10',
      dataVersion: '2026-11',
      unmappedDoses: [],
      groups: [
        group({ group: 'dtap', label: 'DTaP/Tdap/Td', doses: [shot] }),
        group({ group: 'ipv', label: 'Polio', doses: [shot] }),
        group({ group: 'hib', label: 'Hib', doses: [shot] }),
        group({
          group: 'hepb',
          label: 'Hep B',
          doses: [{ ...shot, counted: false, status: 'extraneous', doseNumber: null }],
        }),
      ],
    };
    expect(sameShotText(forecast, 'pentacel-1', 'dtap')).toBe('Polio 1, Hib 1');
  });
});
