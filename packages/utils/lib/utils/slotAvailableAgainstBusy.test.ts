import { Schedule, Slot } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { SCHEDULE_EXTENSION_URL, TIMEZONE_EXTENSION_URL } from '../fhir/constants';
import { Capacity, HourOfDay, ScheduleDay, slotAvailableAgainstBusy } from './scheduleUtils';

// Fixed UTC date (Monday) for stable day-of-week + timezone math.
const SLOT_DATE_NY = '2025-01-06'; // Monday in America/New_York
const TIMEZONE = 'America/New_York';

const makeDaySchedule = (open: number, close: number, capacity: number): ScheduleDay => {
  const hours: Capacity[] = [];
  for (let h = open; h < close; h++) {
    hours.push({ hour: h as Capacity['hour'], capacity, providers: capacity });
  }
  return {
    open: open as HourOfDay,
    close: close as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    workingDay: true,
    hours,
  };
};

const makeSchedule = (open: number, close: number, capacity: number, id = 'sched-1'): Schedule => {
  const day = makeDaySchedule(open, close, capacity);
  const scheduleExt = {
    schedule: {
      sunday: day,
      monday: day,
      tuesday: day,
      wednesday: day,
      thursday: day,
      friday: day,
      saturday: day,
    },
    scheduleOverrides: {},
  };
  return {
    resourceType: 'Schedule',
    id,
    active: true,
    extension: [
      { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(scheduleExt) },
      { url: TIMEZONE_EXTENSION_URL, valueString: TIMEZONE },
    ],
    actor: [{ reference: 'Location/loc-1' }],
  };
};

const makeSlot = (
  hour: number,
  lengthMinutes: number,
  overrides: { id?: string; scheduleId?: string; status?: Slot['status'] } = {}
): Slot => {
  const hh = String(hour).padStart(2, '0');
  const start = `${SLOT_DATE_NY}T${hh}:00:00.000-05:00`; // NY EST offset for Jan
  const endHour = hour + Math.floor(lengthMinutes / 60);
  const endMin = lengthMinutes % 60;
  const eh = String(endHour).padStart(2, '0');
  const em = String(endMin).padStart(2, '0');
  const end = `${SLOT_DATE_NY}T${eh}:${em}:00.000-05:00`;
  return {
    resourceType: 'Slot',
    id: overrides.id,
    status: overrides.status ?? 'free',
    start,
    end,
    schedule: { reference: `Schedule/${overrides.scheduleId ?? 'sched-1'}` },
  };
};

describe('slotAvailableAgainstBusy — happy path', () => {
  it('returns true when no busy slots exist and the slot is on the cadence grid', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [] })).toBe(true);
  });

  it('returns true when a busy slot exists at a different time', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    const busy = makeSlot(11, 60, { id: 'busy-1', status: 'busy' });
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [busy] })).toBe(true);
  });
});

describe('slotAvailableAgainstBusy — capacity exhaustion', () => {
  it('returns false when an existing busy slot is at the same start time and the bucket has capacity=1', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    const busy = makeSlot(10, 60, { id: 'busy-1', status: 'busy' });
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [busy] })).toBe(false);
  });

  it('returns true when one of two providers is busy at the requested time — bucket still has room', () => {
    const schedule = makeSchedule(9, 17, 2);
    const slot = makeSlot(10, 60);
    const busy = makeSlot(10, 60, { id: 'busy-1', status: 'busy' });
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [busy] })).toBe(true);
  });

  it('returns false when both providers are busy at the requested time (capacity=2, 2 busy)', () => {
    const schedule = makeSchedule(9, 17, 2);
    const slot = makeSlot(10, 60);
    const busies = [
      makeSlot(10, 60, { id: 'busy-1', status: 'busy' }),
      makeSlot(10, 60, { id: 'busy-2', status: 'busy-tentative' }),
    ];
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: busies })).toBe(false);
  });
});

describe('slotAvailableAgainstBusy — non-overlapping busy slots are irrelevant', () => {
  it('ignores a busy slot from a peer Schedule at a different time', () => {
    // The pure predicate doesn't filter by schedule id — caller (checkSlotAvailable)
    // is responsible for fetching only relevant busy slots. Here we verify
    // that a peer-schedule busy at a different time doesn't fail the check.
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    const peerBusy = makeSlot(14, 60, { id: 'peer-busy', scheduleId: 'other-schedule', status: 'busy' });
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [peerBusy] })).toBe(true);
  });

  it('uses the SAME bucket subtraction even when busy slot is on a different schedule (peer-fold semantics)', () => {
    // When the caller folds peer busy slots into the input (the
    // PR-with-multiple-roles "one human, one calendar" rule), the
    // predicate correctly subtracts them. Same time = bucket exhausted.
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    const peerBusy = makeSlot(10, 60, { id: 'peer-busy', scheduleId: 'other-schedule', status: 'busy' });
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [peerBusy] })).toBe(false);
  });
});

describe('slotAvailableAgainstBusy — invalid inputs', () => {
  it('returns false when slot.start is missing', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    expect(slotAvailableAgainstBusy({ slot: { ...slot, start: '' }, schedule, busySlots: [] })).toBe(false);
  });

  it('returns false when slot.end is missing', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(10, 60);
    expect(slotAvailableAgainstBusy({ slot: { ...slot, end: '' }, schedule, busySlots: [] })).toBe(false);
  });
});

describe('slotAvailableAgainstBusy — outside open hours', () => {
  it('returns false when the slot starts before the schedule opens', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(7, 60); // 7am — before 9am open
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [] })).toBe(false);
  });

  it('returns false when the slot ends after the schedule closes', () => {
    const schedule = makeSchedule(9, 17, 1);
    const slot = makeSlot(17, 60); // 5pm start, ends 6pm — past 5pm close
    expect(slotAvailableAgainstBusy({ slot, schedule, busySlots: [] })).toBe(false);
  });
});
