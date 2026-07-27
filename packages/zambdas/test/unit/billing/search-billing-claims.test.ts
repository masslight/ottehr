import { Claim } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { claimMatchesServiceDateRange, getClaimServiceDate } from '../../../src/billing/search-billing-claims';

const makeClaim = (created: string, servicedStart?: string): Claim =>
  ({
    resourceType: 'Claim',
    created,
    item: servicedStart
      ? [
          {
            servicedPeriod: {
              start: servicedStart,
            },
          },
        ]
      : undefined,
  }) as unknown as Claim;

describe('search-billing-claims service date', () => {
  it('derives the service date from the first service line, not the creation date', () => {
    expect(getClaimServiceDate(makeClaim('2026-07-21', '2026-07-19'))).toBe('2026-07-19');
  });

  it('falls back to created only when the claim has no service line', () => {
    expect(getClaimServiceDate(makeClaim('2026-07-21'))).toBe('2026-07-21');
  });

  it('windows on the service date, not the creation date', () => {
    const claim = makeClaim('2026-07-21', '2026-07-19');
    expect(claimMatchesServiceDateRange(claim, '2026-07-21', '2026-07-21')).toBe(false);
    expect(claimMatchesServiceDateRange(claim, '2026-07-19', '2026-07-19')).toBe(true);
  });

  it('matches inside an inclusive range and excludes outside it, with open-ended bounds', () => {
    const claim = makeClaim('2026-07-25', '2026-07-20');
    expect(claimMatchesServiceDateRange(claim, '2026-07-19', '2026-07-21')).toBe(true);
    expect(claimMatchesServiceDateRange(claim, '2026-07-21', '2026-07-31')).toBe(false);
    expect(claimMatchesServiceDateRange(claim, undefined, '2026-07-20')).toBe(true);
    expect(claimMatchesServiceDateRange(claim, '2026-07-20', undefined)).toBe(true);
  });
});
