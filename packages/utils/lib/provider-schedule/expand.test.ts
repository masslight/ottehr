import { describe, expect, it } from 'vitest';
import {
  cycleWeekForDate,
  effectiveVisitTypes,
  expandProviderSchedule,
  isAppointmentOutsideSchedule,
  openTimeForDay,
  slotsThatFit,
  subtractRanges,
  templateForDate,
  validateTemplate,
} from './expand';
import { ProviderScheduleConfig, ProviderScheduleTemplate, ScheduleVisitType, TemplateBlock } from './types';

const TZ = 'America/New_York';

const block = (overrides: Partial<TemplateBlock>): TemplateBlock => ({
  id: 'b',
  weekday: 1,
  cycleWeek: 1,
  startTime: '08:00',
  endTime: '12:00',
  kind: 'bookable',
  label: 'Morning clinic',
  visitTypeIds: [],
  ...overrides,
});

const template = (overrides: Partial<ProviderScheduleTemplate>): ProviderScheduleTemplate => ({
  id: 't1',
  name: 'Standard',
  locationId: 'loc',
  effectiveFrom: '2026-01-05',
  cycleWeeks: 1,
  blocks: [],
  ...overrides,
});

const config = (overrides: Partial<ProviderScheduleConfig>): ProviderScheduleConfig => ({
  providerId: 'p1',
  timezone: TZ,
  visitTypeSettings: [],
  templates: [],
  exceptions: [],
  ...overrides,
});

const visitTypes: ScheduleVisitType[] = [
  { id: 'fu', name: 'Follow-up', serviceCategoryCode: 'fu', defaultDurationMinutes: 20, color: '#000' },
  { id: 'np', name: 'New patient', serviceCategoryCode: 'np', defaultDurationMinutes: 40, color: '#000' },
];

describe('templateForDate', () => {
  it('picks the latest effectiveFrom among templates in effect', () => {
    const old = template({ id: 'old', effectiveFrom: '2026-01-01' });
    const summer = template({ id: 'summer', effectiveFrom: '2026-06-01', effectiveTo: '2026-08-31' });
    expect(templateForDate([old, summer], '2026-05-31')?.id).toBe('old');
    expect(templateForDate([old, summer], '2026-07-01')?.id).toBe('summer');
    expect(templateForDate([old, summer], '2026-09-01')?.id).toBe('old');
    expect(templateForDate([old, summer], '2025-12-31')).toBeUndefined();
  });
});

describe('cycleWeekForDate', () => {
  it('alternates weeks counted from the week containing effectiveFrom', () => {
    // 2026-01-07 is a Wednesday; its week starts Monday 2026-01-05.
    const t = template({ effectiveFrom: '2026-01-07', cycleWeeks: 2 });
    expect(cycleWeekForDate(t, '2026-01-05')).toBe(1);
    expect(cycleWeekForDate(t, '2026-01-11')).toBe(1);
    expect(cycleWeekForDate(t, '2026-01-12')).toBe(2);
    expect(cycleWeekForDate(t, '2026-01-19')).toBe(1);
  });
});

describe('subtractRanges', () => {
  it('splits around a cut in the middle and drops fully-covered ranges', () => {
    expect(subtractRanges({ start: 0, end: 100 }, [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
    expect(subtractRanges({ start: 10, end: 20 }, [{ start: 0, end: 30 }])).toEqual([]);
    expect(subtractRanges({ start: 10, end: 20 }, [{ start: 20, end: 30 }])).toEqual([{ start: 10, end: 20 }]);
  });
});

describe('expandProviderSchedule', () => {
  const t = template({
    blocks: [
      block({ id: 'mon-am', weekday: 1, startTime: '08:00', endTime: '12:00' }),
      block({ id: 'mon-lunch', weekday: 1, startTime: '12:00', endTime: '13:00', kind: 'unavailable', label: 'Lunch' }),
      block({ id: 'tue-am', weekday: 2, startTime: '09:00', endTime: '11:00' }),
    ],
  });

  it('places template blocks on matching weekdays in the provider timezone', () => {
    const out = expandProviderSchedule(config({ templates: [t] }), '2026-03-09', '2026-03-10');
    expect(out.map((b) => b.key)).toEqual(['mon-am:2026-03-09', 'mon-lunch:2026-03-09', 'tue-am:2026-03-10']);
    // 2026-03-09 is after the US DST change, so Eastern is UTC-4.
    expect(out[0].start).toBe('2026-03-09T08:00:00-04:00');
  });

  it('removes all template blocks on an all-day time-off date but shows the time off', () => {
    const out = expandProviderSchedule(
      config({
        templates: [t],
        exceptions: [{ id: 'pto', date: '2026-03-09', kind: 'unavailable', label: 'PTO', visitTypeIds: [] }],
      }),
      '2026-03-09',
      '2026-03-09'
    );
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('PTO');
  });

  it('carves a partial time-off exception out of a template block', () => {
    const out = expandProviderSchedule(
      config({
        templates: [t],
        exceptions: [
          {
            id: 'mtg',
            date: '2026-03-09',
            kind: 'unavailable',
            label: 'Meeting',
            startTime: '09:00',
            endTime: '10:00',
            visitTypeIds: [],
          },
        ],
      }),
      '2026-03-09',
      '2026-03-09'
    );
    const clinic = out.filter((b) => b.source.type === 'template' && b.kind === 'bookable');
    expect(clinic.map((b) => [b.start.slice(11, 16), b.end.slice(11, 16)])).toEqual([
      ['08:00', '09:00'],
      ['10:00', '12:00'],
    ]);
    expect(new Set(out.map((b) => b.key)).size).toBe(out.length);
  });

  it('adds bookable exceptions as extra blocks', () => {
    const out = expandProviderSchedule(
      config({
        templates: [t],
        exceptions: [
          {
            id: 'sat',
            date: '2026-03-14',
            kind: 'bookable',
            label: 'Flu clinic',
            startTime: '09:00',
            endTime: '12:00',
            visitTypeIds: ['fu'],
          },
        ],
      }),
      '2026-03-14',
      '2026-03-14'
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'bookable', label: 'Flu clinic', visitTypeIds: ['fu'] });
  });

  it('uses only the blocks of the matching cycle week', () => {
    const alt = template({
      cycleWeeks: 2,
      blocks: [
        block({ id: 'w1', cycleWeek: 1 }),
        block({ id: 'w2', cycleWeek: 2, startTime: '13:00', endTime: '17:00' }),
      ],
    });
    const out = expandProviderSchedule(config({ templates: [alt] }), '2026-01-05', '2026-01-19');
    expect(out.map((b) => b.key)).toEqual(['w1:2026-01-05', 'w2:2026-01-12', 'w1:2026-01-19']);
  });
});

describe('effectiveVisitTypes', () => {
  it('applies per-provider durations and drops disabled visit types', () => {
    const out = effectiveVisitTypes(
      {
        visitTypeSettings: [
          { visitTypeId: 'np', enabled: true, durationMinutes: 60 },
          { visitTypeId: 'fu', enabled: false },
        ],
      },
      visitTypes
    );
    expect(out.map((v) => [v.id, v.durationMinutes])).toEqual([['np', 60]]);
  });
});

describe('openTimeForDay', () => {
  it('counts slots per visit type in the gaps between appointments, honoring maxPerDay', () => {
    const [blk] = expandProviderSchedule(
      config({ templates: [template({ blocks: [block({ id: 'am', startTime: '08:00', endTime: '10:00' })] })] }),
      '2026-03-09',
      '2026-03-09'
    );
    const effective = effectiveVisitTypes(
      { visitTypeSettings: [{ visitTypeId: 'np', enabled: true, maxPerDay: 1 }] },
      visitTypes
    );
    const result = openTimeForDay(
      [blk],
      [
        {
          id: 'a1',
          providerId: 'p1',
          patientName: 'X',
          visitTypeId: 'fu',
          start: '2026-03-09T08:30:00-04:00',
          end: '2026-03-09T08:50:00-04:00',
          status: 'booked',
        },
      ],
      effective
    );
    // Free: 08:00–08:30 (30m) and 08:50–10:00 (70m).
    expect(result.openMinutes).toBe(100);
    expect(result.bookedMinutes).toBe(20);
    expect(result.openSlotsByVisitType.fu).toBe(1 + 3);
    expect(result.openSlotsByVisitType.np).toBe(1); // 0 + 1 would fit, capped at 1 anyway
  });
});

describe('slotsThatFit', () => {
  it('floors partial slots', () => {
    expect(slotsThatFit(130, 40)).toBe(3);
    expect(slotsThatFit(30, 0)).toBe(0);
  });
});

describe('validateTemplate', () => {
  it('flags overlapping blocks on the same day and week only', () => {
    const issues = validateTemplate(
      template({
        cycleWeeks: 2,
        blocks: [
          block({ id: 'a', startTime: '08:00', endTime: '10:00' }),
          block({ id: 'b', startTime: '09:30', endTime: '11:00' }),
          block({ id: 'c', startTime: '09:30', endTime: '11:00', cycleWeek: 2 }),
          block({ id: 'd', startTime: '10:00', endTime: '11:00', weekday: 2 }),
        ],
      })
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockIds).toEqual(['a', 'b']);
  });

  it('flags inverted times and bad cycle weeks', () => {
    const issues = validateTemplate(
      template({ blocks: [block({ id: 'x', startTime: '10:00', endTime: '09:00' }), block({ id: 'y', cycleWeek: 3 })] })
    );
    expect(issues.map((i) => i.blockIds)).toEqual([['x'], ['y']]);
  });
});

describe('isAppointmentOutsideSchedule', () => {
  const blocks = expandProviderSchedule(
    config({
      templates: [
        template({
          blocks: [
            block({ id: 'a', startTime: '08:00', endTime: '09:00', visitTypeIds: ['fu'] }),
            block({ id: 'b', startTime: '09:00', endTime: '10:00', visitTypeIds: ['fu', 'np'] }),
          ],
        }),
      ],
    }),
    '2026-03-09',
    '2026-03-09'
  );
  const appt = (
    visitTypeId: string,
    start: string,
    end: string
  ): Parameters<typeof isAppointmentOutsideSchedule>[0] => ({
    id: 'x',
    providerId: 'p1',
    patientName: 'X',
    visitTypeId,
    start: `2026-03-09T${start}:00-04:00`,
    end: `2026-03-09T${end}:00-04:00`,
    status: 'booked',
  });

  it('accepts appointments spanning adjacent blocks that both allow the type', () => {
    expect(isAppointmentOutsideSchedule(appt('fu', '08:50', '09:10'), blocks, ['fu', 'np'])).toBe(false);
  });

  it('flags a type the block does not allow, or time outside any block', () => {
    expect(isAppointmentOutsideSchedule(appt('np', '08:20', '09:00'), blocks, ['fu', 'np'])).toBe(true);
    expect(isAppointmentOutsideSchedule(appt('fu', '09:50', '10:10'), blocks, ['fu', 'np'])).toBe(true);
  });
});
