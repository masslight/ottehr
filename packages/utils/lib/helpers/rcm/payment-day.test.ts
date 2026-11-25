import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { isFuturePaymentDay, paymentDayOf, practiceToday } from './payment-day';

describe('paymentDayOf', () => {
  it('keeps a date-only payment date as is', () => {
    expect(paymentDayOf('2026-03-05')).toBe('2026-03-05');
  });

  it('places a timestamp on the practice-local day', () => {
    // 02:30 UTC on the 6th is still the 5th in New York
    expect(paymentDayOf('2026-03-06T02:30:00.000Z')).toBe('2026-03-05');
    expect(paymentDayOf('2026-03-06T15:00:00.000Z')).toBe('2026-03-06');
  });

  it('returns an unparseable value unchanged', () => {
    expect(paymentDayOf('not-a-date')).toBe('not-a-date');
  });
});

describe('practiceToday', () => {
  it("is the practice's day, not UTC's", () => {
    expect(practiceToday(DateTime.fromISO('2026-03-06T02:30:00.000Z'))).toBe('2026-03-05');
  });
});

describe('isFuturePaymentDay', () => {
  it("treats only days after the practice's today as future", () => {
    // 02:30 UTC on the 6th is still the 5th in New York
    const now = DateTime.fromISO('2026-03-06T02:30:00.000Z');

    expect(isFuturePaymentDay('2026-03-04', now)).toBe(false);
    expect(isFuturePaymentDay('2026-03-05', now)).toBe(false);
    expect(isFuturePaymentDay('2026-03-06', now)).toBe(true);
  });
});
