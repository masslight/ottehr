import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { convertCapacityListToBucketedTimeSlots } from './dateUtils';
import { Capacity } from './scheduleUtils';

// Fixed UTC-midnight base date so slot-start times are stable across env tz.
const START_DATE = DateTime.fromISO('2026-06-01T00:00:00.000Z', { zone: 'utc' });

// Minutes-from-midnight, sorted ascending. Most cadence tests care about
// the gaps between slot starts, not the absolute timestamps.
const slotMinutesFromMidnight = (slots: Record<string, number>): number[] =>
  Object.keys(slots)
    .map((iso) => {
      const dt = DateTime.fromISO(iso, { zone: 'utc' });
      return dt.hour * 60 + dt.minute;
    })
    .sort((a, b) => a - b);

const slotAt = (hour: number, minute: number): string =>
  DateTime.fromISO(`2026-06-01T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`, {
    zone: 'utc',
  }).toISO()!;

// Timezone-agnostic capacity lookup. The per-hour-bucket path in
// convertCapacityListToBucketedTimeSlots emits ISO keys in the local zone
// (it reparses through DateTime.fromISO without {setZone:true}), while the
// session-based path emits UTC ISOs. String-exact lookup on slotAt(...)
// only works for session-based output. This helper matches by UTC
// hour/minute, working for both paths regardless of the test machine's
// local timezone.
const capacityAtUtc = (slots: Record<string, number>, hour: number, minute: number): number | undefined => {
  for (const [iso, cap] of Object.entries(slots)) {
    const dt = DateTime.fromISO(iso, { zone: 'utc' });
    if (dt.hour === hour && dt.minute === minute) return cap;
  }
  return undefined;
};

const cap = (hour: number, providers: number): Capacity => ({
  hour: hour as Capacity['hour'],
  capacity: 0,
  providers,
});

describe('convertCapacityListToBucketedTimeSlots — per-hour bucket path (no explicit cadence, slotLength divides 60)', () => {
  it('15-min slot: 4 starts per open hour at :00 :15 :30 :45', () => {
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1)], START_DATE, 15);
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60, 9 * 60 + 15, 9 * 60 + 30, 9 * 60 + 45]);
  });

  it('30-min slot: 2 starts per open hour at :00 :30 (no explicit cadence → no per-hour-bucket override)', () => {
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1)], START_DATE, 30);
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60, 9 * 60 + 30]);
  });

  it('60-min slot: 1 start per open hour at :00', () => {
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1)], START_DATE, 60);
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60]);
  });
});

describe('convertCapacityListToBucketedTimeSlots — session-based path (super-hour slot or explicit cadence)', () => {
  it('45-min slot, no explicit cadence: 15-min stride from gcd(45, 60)', () => {
    // Session = 3 hours = 180 min. Stride = 15. Starts at offset 0, 15, …, 135.
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1), cap(10, 1), cap(11, 1)], START_DATE, 45);
    const minutes = slotMinutesFromMidnight(result);
    const expected: number[] = [];
    for (let offset = 0; offset + 45 <= 180; offset += 15) expected.push(9 * 60 + offset);
    expect(minutes).toEqual(expected);
    expect(minutes.length).toBe(10);
  });

  it('90-min slot, no explicit cadence: 30-min stride from gcd(90, 60) — the user-observed default', () => {
    // Reproduces what an admin sees today when no cadence is configured on a
    // 90-minute service: slot starts every 30 min, not every 15.
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1), cap(10, 1), cap(11, 1)], START_DATE, 90);
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60, 9 * 60 + 30, 10 * 60, 10 * 60 + 30]);
  });

  it('90-min slot with explicit cadence=15: 15-min stride (cadence overrides the gcd default)', () => {
    // The regression-protection case: if cadence threading breaks, this falls
    // back to the 30-min default above and the test fails.
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1), cap(10, 1), cap(11, 1)], START_DATE, 90, 15);
    const minutes = slotMinutesFromMidnight(result);
    const expected: number[] = [];
    for (let offset = 0; offset + 90 <= 180; offset += 15) expected.push(9 * 60 + offset);
    expect(minutes).toEqual(expected);
    expect(minutes.length).toBe(7);
  });

  it('30-min slot with explicit cadence=15: 15-min stride (cadence forces session-based path, overriding the per-hour-bucket fast path)', () => {
    // Without explicit cadence a 30-min slot would take the per-hour-bucket
    // fast path and produce 30-min spacing. Setting cadence=15 explicitly
    // forces the session-based path → 15-min spacing.
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1), cap(10, 1)], START_DATE, 30, 15);
    expect(slotMinutesFromMidnight(result)).toEqual([
      9 * 60,
      9 * 60 + 15,
      9 * 60 + 30,
      9 * 60 + 45,
      10 * 60,
      10 * 60 + 15,
      10 * 60 + 30,
    ]);
  });

  it('60-min slot with explicit cadence=30: 30-min stride', () => {
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1), cap(10, 1)], START_DATE, 60, 30);
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60, 9 * 60 + 30, 10 * 60]);
  });

  it('120-min slot, no explicit cadence: 60-min stride from gcd(120, 60)', () => {
    const result = convertCapacityListToBucketedTimeSlots(
      [cap(9, 1), cap(10, 1), cap(11, 1), cap(12, 1)],
      START_DATE,
      120
    );
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60, 10 * 60, 11 * 60]);
  });

  it('non-consecutive open hours form separate sessions', () => {
    // Hours 9, 10, then 13, 14 → two sessions, each 120 min. 90-min slot,
    // default cadence 30 → 2 starts per session.
    const result = convertCapacityListToBucketedTimeSlots(
      [cap(9, 1), cap(10, 1), cap(13, 1), cap(14, 1)],
      START_DATE,
      90
    );
    expect(slotMinutesFromMidnight(result)).toEqual([9 * 60, 9 * 60 + 30, 13 * 60, 13 * 60 + 30]);
  });

  it('multi-hour slot uses the minimum providers across every hour it touches', () => {
    // Hours 9 (2 providers) and 10 (1 provider). 60-min slot with cadence=30
    // → 3 candidates: 9:00 (only hour 9), 9:30 (touches 9+10), 10:00 (only 10).
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 2), cap(10, 1)], START_DATE, 60, 30);
    expect(result[slotAt(9, 0)]).toBe(2); // hour 9 alone
    expect(result[slotAt(9, 30)]).toBe(1); // straddles 9+10, min(2, 1) = 1
    expect(result[slotAt(10, 0)]).toBe(1); // hour 10 alone
  });
});

describe('convertCapacityListToBucketedTimeSlots — slot does not fit', () => {
  it('returns empty when the slot is longer than the session', () => {
    // 90-min slot, only 1 hour open → no slots fit.
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1)], START_DATE, 90);
    expect(Object.keys(result)).toEqual([]);
  });

  it('drops slots that touch an hour with no providers configured', () => {
    // 60-min slot with cadence=30 starting at hour 9 only (hour 10 not open
    // → has no providers entry). The 9:00 slot ends at 10:00 and only
    // touches hour 9, so it's kept; no 9:30 slot is emitted because the
    // session length is exactly the slot length (1 hour).
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1)], START_DATE, 60, 30);
    expect(Object.keys(result)).toEqual([slotAt(9, 0)]);
    expect(result[slotAt(9, 0)]).toBe(1);
  });
});

describe('convertCapacityListToBucketedTimeSlots — closing-time guard', () => {
  // The session-based path guards `offset + slotLength <= sessionMinutes`
  // so no slot is emitted that would end after the schedule closes. These
  // tests make that property explicit so a regression that drops the
  // guard fails loudly rather than relying on the cadence-test assertions
  // to fail downstream as a side effect.

  it('emits a slot ending exactly at close but not one ending past close (90-min slot, 4-hour session)', () => {
    // Hours 9,10,11,12 → session ends at 13:00 (sessionEndHour = 12 + 1).
    // 90-min slot, default cadence 30. Last admissible start is 11:30
    // (ends 13:00 — exactly close). A 12:00 start would end at 13:30 —
    // 30 min past close — and must be excluded.
    const result = convertCapacityListToBucketedTimeSlots(
      [cap(9, 1), cap(10, 1), cap(11, 1), cap(12, 1)],
      START_DATE,
      90
    );
    const minutes = slotMinutesFromMidnight(result);
    // 6 starts: 9:00, 9:30, 10:00, 10:30, 11:00, 11:30.
    expect(minutes).toEqual([9 * 60, 9 * 60 + 30, 10 * 60, 10 * 60 + 30, 11 * 60, 11 * 60 + 30]);
    // Explicit negative assertion: the past-close start must not appear.
    expect(minutes).not.toContain(12 * 60);
  });

  it('does not emit a 90-min slot whose end would fall past close even with explicit cadence=15', () => {
    // Same session as above but with explicit cadence — confirms the
    // closing-time guard fires on the session-based path regardless of
    // whether the cadence comes from gcd-default or from an explicit
    // override. Last admissible start is 11:30 (ends 13:00 = close).
    const result = convertCapacityListToBucketedTimeSlots(
      [cap(9, 1), cap(10, 1), cap(11, 1), cap(12, 1)],
      START_DATE,
      90,
      15
    );
    const minutes = slotMinutesFromMidnight(result);
    // With cadence=15 the stride is finer; max admissible start is still
    // 11:30 (offset 150 → 150 + 90 = 240 = sessionMinutes). 11:45 would
    // be offset 165 → 165 + 90 = 255 > 240 — must be excluded.
    expect(minutes[minutes.length - 1]).toBe(11 * 60 + 30);
    expect(minutes).not.toContain(11 * 60 + 45);
  });

  it('100-min slot in a 3-hour session: last start is 10:20, ending exactly at close (12:00)', () => {
    // Slot length that doesn't divide 60 and doesn't fit a clean number
    // of times into the session — surfaces the off-by-one risks more
    // sharply than the 90/180 case where things divide evenly.
    // Default cadence = gcd(100, 60) = 20.
    // Session = 180 min. Max admissible offset = 80 (80 + 100 = 180).
    // Starts: 0, 20, 40, 60, 80 → 9:00, 9:20, 9:40, 10:00, 10:20.
    // 10:40 would be offset 100 → 100 + 100 = 200 > 180 — excluded.
    const result = convertCapacityListToBucketedTimeSlots([cap(9, 1), cap(10, 1), cap(11, 1)], START_DATE, 100);
    const minutes = slotMinutesFromMidnight(result);
    expect(minutes).toEqual([9 * 60, 9 * 60 + 20, 9 * 60 + 40, 10 * 60, 10 * 60 + 20]);
    expect(minutes).not.toContain(10 * 60 + 40);
  });
});

// Decimal-providers + >1 integer cases. The shared bucket math is
// `totalBookings = floor(providersForHour * 60 / slotLength)`. Floor
// silently swallows fractional residue that doesn't accumulate to a full
// slot — by design under the "average providers per hour" semantic the
// rollout plan settled on, but admin-visible only via the resulting slot
// count. These tests lock in the current behavior.
describe('convertCapacityListToBucketedTimeSlots — decimal and >1 providers (current behavior)', () => {
  describe('providers = 0.5 (half-time provider)', () => {
    it('15-min slot: 2 bookings/hour, distributed across alternating buckets', () => {
      // providersForHour = 0.5 → totalBookings = floor(0.5 * 60/15) = 2
      // divideHourlyCapacityBySlotInterval(2, 15) → numBuckets=4, shortage=2 →
      // alternating high/low: {:00 → 1, :15 → 0, :30 → 1, :45 → 0}
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 0.5)], START_DATE, 15);
      expect(capacityAtUtc(result, 9, 0)).toBe(1);
      expect(capacityAtUtc(result, 9, 15)).toBe(0);
      expect(capacityAtUtc(result, 9, 30)).toBe(1);
      expect(capacityAtUtc(result, 9, 45)).toBe(0);
    });

    it('30-min slot: 1 booking/hour', () => {
      // providersForHour = 0.5 → totalBookings = floor(0.5 * 60/30) = 1
      // numBuckets=2, capacity=1, shortage=1 → {:00 → 1, :30 → 0}
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 0.5)], START_DATE, 30);
      expect(capacityAtUtc(result, 9, 0)).toBe(1);
      expect(capacityAtUtc(result, 9, 30)).toBe(0);
    });

    it('60-min slot: 0 bookings/hour (the half-time provider contributes nothing)', () => {
      // providersForHour = 0.5 → totalBookings = floor(0.5) = 0. The
      // fractional value is structurally incompatible with a 60-min visit
      // (you can't have half a provider available for the full hour).
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 0.5)], START_DATE, 60);
      expect(capacityAtUtc(result, 9, 0)).toBe(0);
    });
  });

  describe('providers = 1.5 (one full + one half-time)', () => {
    it('15-min slot: 6 bookings/hour, distributed across all four buckets', () => {
      // providersForHour = 1.5 → totalBookings = floor(1.5 * 60/15) = 6
      // numBuckets=4, high=ceil(6/4)=2, low=floor(6/4)=1, shortage=2 →
      // {:00 → 2, :15 → 1, :30 → 2, :45 → 1}
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 1.5)], START_DATE, 15);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
      expect(capacityAtUtc(result, 9, 15)).toBe(1);
      expect(capacityAtUtc(result, 9, 30)).toBe(2);
      expect(capacityAtUtc(result, 9, 45)).toBe(1);
    });

    it('30-min slot: 3 bookings/hour', () => {
      // providersForHour = 1.5 → totalBookings = floor(1.5 * 60/30) = 3
      // numBuckets=2, high=2, low=1, shortage=1 → {:00 → 2, :30 → 1}
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 1.5)], START_DATE, 30);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
      expect(capacityAtUtc(result, 9, 30)).toBe(1);
    });

    it('60-min slot: 1 booking/hour (the 0.5 is lost)', () => {
      // providersForHour = 1.5 → totalBookings = floor(1.5) = 1. The
      // "one full + one half-time" tooltip example is wrong for 60-min
      // slots: the half-time contribution is rounded away.
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 1.5)], START_DATE, 60);
      expect(capacityAtUtc(result, 9, 0)).toBe(1);
    });
  });

  describe('providers = 2 (two integer providers)', () => {
    it('60-min slot: 2 concurrent bookings/hour', () => {
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 2)], START_DATE, 60);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
    });

    it('30-min slot: 4 bookings/hour, evenly distributed', () => {
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 2)], START_DATE, 30);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
      expect(capacityAtUtc(result, 9, 30)).toBe(2);
    });

    it('15-min slot: 8 bookings/hour, evenly distributed', () => {
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 2)], START_DATE, 15);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
      expect(capacityAtUtc(result, 9, 15)).toBe(2);
      expect(capacityAtUtc(result, 9, 30)).toBe(2);
      expect(capacityAtUtc(result, 9, 45)).toBe(2);
    });
  });

  describe('providers = 2.5', () => {
    it('30-min slot: 5 bookings/hour with bucket residue', () => {
      // providersForHour = 2.5 → totalBookings = floor(2.5 * 60/30) = 5
      // numBuckets=2, high=3, low=2, shortage=1 → {:00 → 3, :30 → 2}
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 2.5)], START_DATE, 30);
      expect(capacityAtUtc(result, 9, 0)).toBe(3);
      expect(capacityAtUtc(result, 9, 30)).toBe(2);
    });

    it('60-min slot: 2 bookings/hour (the 0.5 is lost)', () => {
      // providersForHour = 2.5 → totalBookings = floor(2.5) = 2.
      const result = convertCapacityListToBucketedTimeSlots([cap(9, 2.5)], START_DATE, 60);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
    });
  });
});

// prebookSlots is a Location-semantic "N bookings/hour, period" demand cap.
// The math inverts the providers normalization so the round-trip gives N
// regardless of slot length: providersForHour = prebookSlots * slotLength
// / 60, then totalBookings = floor(providersForHour * 60 / slotLength) =
// floor(prebookSlots). This describe block makes that property explicit so
// a regression in the formula (e.g., dropping the inverse multiplication)
// would fail loudly.
describe('convertCapacityListToBucketedTimeSlots — prebookSlots (Location demand cap)', () => {
  const capLoc = (hour: number, prebookSlots: number): Capacity => ({
    hour: hour as Capacity['hour'],
    capacity: 0,
    prebookSlots,
  });

  describe('integer prebookSlots is slot-length-invariant — same total bookings/hour across all slot lengths', () => {
    it('prebookSlots=4, 60-min slot: 4 bookings in one 60-min bucket', () => {
      const result = convertCapacityListToBucketedTimeSlots([capLoc(9, 4)], START_DATE, 60);
      expect(capacityAtUtc(result, 9, 0)).toBe(4);
    });

    it('prebookSlots=4, 30-min slot: 4 bookings split across two 30-min buckets', () => {
      const result = convertCapacityListToBucketedTimeSlots([capLoc(9, 4)], START_DATE, 30);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
      expect(capacityAtUtc(result, 9, 30)).toBe(2);
    });

    it('prebookSlots=4, 15-min slot: 4 bookings split across four 15-min buckets', () => {
      const result = convertCapacityListToBucketedTimeSlots([capLoc(9, 4)], START_DATE, 15);
      expect(capacityAtUtc(result, 9, 0)).toBe(1);
      expect(capacityAtUtc(result, 9, 15)).toBe(1);
      expect(capacityAtUtc(result, 9, 30)).toBe(1);
      expect(capacityAtUtc(result, 9, 45)).toBe(1);
    });
  });

  describe('prebookSlots with bucket residue (uneven distribution within an hour)', () => {
    it('prebookSlots=5, 15-min slot: 5 bookings alternating high/low', () => {
      // 5 bookings / 4 buckets → shortage 3, distribution high/low alternating
      const result = convertCapacityListToBucketedTimeSlots([capLoc(9, 5)], START_DATE, 15);
      expect(capacityAtUtc(result, 9, 0)).toBe(2);
      expect(capacityAtUtc(result, 9, 15)).toBe(1);
      expect(capacityAtUtc(result, 9, 30)).toBe(1);
      expect(capacityAtUtc(result, 9, 45)).toBe(1);
    });
  });

  describe('decimal prebookSlots also truncates — same shape of bug as providers', () => {
    it('prebookSlots=0.5, any slot length: 0 bookings', () => {
      // The Location UI step is 1 (integers only), so this can't reach the
      // field via the standard editor. But the FHIR resource accepts
      // decimals, so an API-direct write would land here. Behavior is
      // consistent with the providers case: floor swallows the fractional
      // residue.
      const result15 = convertCapacityListToBucketedTimeSlots([capLoc(9, 0.5)], START_DATE, 15);
      expect(capacityAtUtc(result15, 9, 0)).toBe(0);
      const result60 = convertCapacityListToBucketedTimeSlots([capLoc(9, 0.5)], START_DATE, 60);
      expect(capacityAtUtc(result60, 9, 0)).toBe(0);
    });

    it('prebookSlots=4.5, any slot length: 4 bookings (the 0.5 is lost)', () => {
      const result60 = convertCapacityListToBucketedTimeSlots([capLoc(9, 4.5)], START_DATE, 60);
      expect(capacityAtUtc(result60, 9, 0)).toBe(4);
      const result30 = convertCapacityListToBucketedTimeSlots([capLoc(9, 4.5)], START_DATE, 30);
      expect((capacityAtUtc(result30, 9, 0) ?? 0) + (capacityAtUtc(result30, 9, 30) ?? 0)).toBe(4);
    });
  });
});
