import { describe, expect, it } from 'vitest';
import { paymentDayOf } from './payment-day';

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
