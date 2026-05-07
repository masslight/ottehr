import { describe, expect, it } from 'vitest';
import {
  BookingInput,
  canScheduleAllBookings,
  MatchingInput,
  ProviderWorkingWindow,
  TimeInterval,
} from './scheduleMatching';

// ── Test helpers ─────────────────────────────────────────────────────────────

const DAY_START = new Date('2026-05-12T13:00:00Z').getTime(); // 9am ET
const DAY_END = new Date('2026-05-12T21:00:00Z').getTime(); // 5pm ET

const t = (offsetMin: number): number => DAY_START + offsetMin * 60 * 1000;
const win = (startMin: number, endMin: number): TimeInterval => ({
  startMs: t(startMin),
  endMs: t(endMin),
});

const fullDay: TimeInterval = { startMs: DAY_START, endMs: DAY_END };

const provider = (providerId: string, freeIntervals: TimeInterval[] = [fullDay]): ProviderWorkingWindow => ({
  providerId,
  freeIntervals,
});

const booking = (id: string, serviceId: string, w: TimeInterval): BookingInput => ({
  id,
  serviceId,
  window: w,
});

const qualMap = (...entries: Array<[string, string[]]>): Map<string, Set<string>> =>
  new Map(entries.map(([service, providers]) => [service, new Set(providers)]));

const wwMap = (...providers: ProviderWorkingWindow[]): Map<string, ProviderWorkingWindow> =>
  new Map(providers.map((p) => [p.providerId, p]));

// ── Spec scenarios from the YourTime requirements doc ───────────────────────

describe('canScheduleAllBookings — spec Example 1', () => {
  // Ally (Botox, Acne, Microneedling), Melissa (Botox, Acne, Microneedling, Urgent Care)
  // Patient wants Botox (30 min, 15-min cadence) at 10:00 Tuesday.
  const providers = ['ally', 'melissa'];
  const qualifications = qualMap(
    ['botox', ['ally', 'melissa']],
    ['acne', ['ally', 'melissa']],
    ['microneedling', ['ally', 'melissa']],
    ['urgent-care', ['melissa']]
  );
  const workingWindows = wwMap(provider('ally'), provider('melissa'));

  it('shows Botox at 10:00 when there are no existing bookings', () => {
    const input: MatchingInput = {
      bookings: [booking('candidate', 'botox', win(60, 90))],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(true);
  });

  it('shows Botox at 10:00 when an existing Microneedling at 10:00 occupies one provider', () => {
    // Either provider can take the Microneedling; the other takes Botox.
    const input: MatchingInput = {
      bookings: [booking('existing-mn', 'microneedling', win(60, 120)), booking('candidate', 'botox', win(60, 90))],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(true);
  });

  it('hides Botox at 10:00 when both providers are required by existing overlapping bookings', () => {
    // Two Microneedlings at 10:00 means both are tied up.
    const input: MatchingInput = {
      bookings: [
        booking('existing-mn-1', 'microneedling', win(60, 120)),
        booking('existing-mn-2', 'microneedling', win(60, 120)),
        booking('candidate', 'botox', win(60, 90)),
      ],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(false);
  });
});

describe('canScheduleAllBookings — spec Example 2', () => {
  // Ally (Botox, Acne), Melissa (Botox, Acne, Urgent Care).
  const providers = ['ally', 'melissa'];
  const qualifications = qualMap(
    ['botox', ['ally', 'melissa']],
    ['acne', ['ally', 'melissa']],
    ['urgent-care', ['melissa']]
  );
  const workingWindows = wwMap(provider('ally'), provider('melissa'));

  it('shows Urgent Care at 10:00 when only Botox is booked (Ally takes Botox, Melissa takes UC)', () => {
    const input: MatchingInput = {
      bookings: [booking('existing-botox', 'botox', win(60, 90)), booking('candidate', 'urgent-care', win(60, 75))],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(true);
    // Witness: Melissa must hold the Urgent Care (she's the only qualified provider).
    expect(result.assignment?.get('candidate')).toBe('melissa');
  });

  it('hides Urgent Care at 10:00 when both Botox and Acne already need both providers', () => {
    // Melissa must take UC (only she qualifies). Then Ally must cover both
    // Botox and Acne at 10:00 — impossible.
    const input: MatchingInput = {
      bookings: [
        booking('existing-botox', 'botox', win(60, 90)),
        booking('existing-acne', 'acne', win(60, 90)),
        booking('candidate', 'urgent-care', win(60, 75)),
      ],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(false);
  });
});

describe('canScheduleAllBookings — spec Example 4 (single specialist)', () => {
  // Heather (LMT) is the only massage provider. She has a Massage 90 booking
  // at 1:00 PM (240–330 minutes from 9am = 13:00–14:30).
  const providers = ['heather'];
  const qualifications = qualMap(['massage-60', ['heather']], ['massage-90', ['heather']]);
  const workingWindows = wwMap(provider('heather'));

  it('hides Massage 60 at 1:30 when 1:00 PM Massage 90 is in progress', () => {
    const input: MatchingInput = {
      bookings: [
        booking('existing-m90', 'massage-90', win(240, 330)),
        booking('candidate', 'massage-60', win(270, 330)),
      ],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(false);
  });

  it('shows Massage 60 at 2:30 (after the existing Massage 90 ends)', () => {
    const input: MatchingInput = {
      bookings: [
        booking('existing-m90', 'massage-90', win(240, 330)),
        booking('candidate', 'massage-60', win(330, 390)),
      ],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(true);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('canScheduleAllBookings — qualification edge cases', () => {
  it('returns infeasible when the candidate service has no qualified providers', () => {
    const input: MatchingInput = {
      bookings: [booking('candidate', 'unknown-service', win(60, 75))],
      providers: ['ally'],
      qualifications: qualMap(['botox', ['ally']]),
      workingWindows: wwMap(provider('ally')),
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(false);
  });

  it('returns feasible when the only candidate provider is exclusively dedicated to the service', () => {
    const input: MatchingInput = {
      bookings: [booking('candidate', 'massage-60', win(60, 120))],
      providers: ['heather'],
      qualifications: qualMap(['massage-60', ['heather']]),
      workingWindows: wwMap(provider('heather')),
    };
    expect(canScheduleAllBookings(input).feasible).toBe(true);
  });
});

describe('canScheduleAllBookings — working-window edges', () => {
  it('hides bookings that fall outside the provider working window', () => {
    // Provider works 11:00–17:00; candidate is 10:00–10:30.
    const input: MatchingInput = {
      bookings: [booking('candidate', 'botox', win(60, 90))],
      providers: ['ally'],
      qualifications: qualMap(['botox', ['ally']]),
      workingWindows: wwMap(provider('ally', [{ startMs: t(120), endMs: t(480) }])),
    };
    expect(canScheduleAllBookings(input).feasible).toBe(false);
  });

  it('treats a booking that ends exactly when another starts as non-overlapping', () => {
    // 10:00–10:30 Botox and 10:30–11:00 Botox — same provider can hold both.
    const input: MatchingInput = {
      bookings: [booking('a', 'botox', win(60, 90)), booking('b', 'botox', win(90, 120))],
      providers: ['ally'],
      qualifications: qualMap(['botox', ['ally']]),
      workingWindows: wwMap(provider('ally')),
    };
    expect(canScheduleAllBookings(input).feasible).toBe(true);
  });

  it('rejects a booking that splits across two disjoint free intervals', () => {
    // Provider has a break from 10:30 to 11:00; candidate runs 10:00–11:30.
    const before: TimeInterval = { startMs: DAY_START, endMs: t(90) };
    const after: TimeInterval = { startMs: t(120), endMs: DAY_END };
    const input: MatchingInput = {
      bookings: [booking('candidate', 'botox', win(60, 150))],
      providers: ['ally'],
      qualifications: qualMap(['botox', ['ally']]),
      workingWindows: wwMap(provider('ally', [before, after])),
    };
    expect(canScheduleAllBookings(input).feasible).toBe(false);
  });
});

describe('canScheduleAllBookings — multi-provider stress', () => {
  it('handles five qualified providers with three concurrent bookings (matches all)', () => {
    const providers = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const qualifications = qualMap(['urgent-care', providers]);
    const workingWindows = wwMap(...providers.map((p) => provider(p)));
    const input: MatchingInput = {
      bookings: [
        booking('a', 'urgent-care', win(60, 75)),
        booking('b', 'urgent-care', win(60, 75)),
        booking('c', 'urgent-care', win(60, 75)),
      ],
      providers,
      qualifications,
      workingWindows,
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(true);
    // Three distinct providers used.
    expect(new Set(result.assignment?.values()).size).toBe(3);
  });

  it('hides the fourth concurrent booking when only three providers exist', () => {
    const providers = ['p1', 'p2', 'p3'];
    const qualifications = qualMap(['urgent-care', providers]);
    const workingWindows = wwMap(...providers.map((p) => provider(p)));
    const input: MatchingInput = {
      bookings: [
        booking('a', 'urgent-care', win(60, 75)),
        booking('b', 'urgent-care', win(60, 75)),
        booking('c', 'urgent-care', win(60, 75)),
        booking('d', 'urgent-care', win(60, 75)),
      ],
      providers,
      qualifications,
      workingWindows,
    };
    expect(canScheduleAllBookings(input).feasible).toBe(false);
  });
});

describe('canScheduleAllBookings — empty input', () => {
  it('returns feasible (and an empty assignment) when there are no bookings', () => {
    const input: MatchingInput = {
      bookings: [],
      providers: [],
      qualifications: new Map(),
      workingWindows: new Map(),
    };
    const result = canScheduleAllBookings(input);
    expect(result.feasible).toBe(true);
    expect(result.assignment?.size).toBe(0);
  });
});
