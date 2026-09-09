import { ClaimItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { deriveClaimBillablePeriod } from '../../../src/billing/shared';

const item = (overrides: Partial<ClaimItem>): ClaimItem => ({
  sequence: 1,
  productOrService: { coding: [{ code: '99213' }] },
  ...overrides,
});

describe('deriveClaimBillablePeriod', () => {
  it('returns undefined when there are no items', () => {
    expect(deriveClaimBillablePeriod([])).toBeUndefined();
    expect(deriveClaimBillablePeriod(undefined)).toBeUndefined();
  });

  it('uses the single item date for both ends when there is one item with a plain servicedDate', () => {
    expect(deriveClaimBillablePeriod([item({ servicedDate: '2026-01-15' })])).toEqual({
      start: '2026-01-15',
      end: '2026-01-15',
    });
  });

  it('uses servicedPeriod start/end for a single item spanning multiple days', () => {
    expect(deriveClaimBillablePeriod([item({ servicedPeriod: { start: '2026-01-01', end: '2026-01-05' } })])).toEqual({
      start: '2026-01-01',
      end: '2026-01-05',
    });
  });

  it('picks the earliest start and latest end across a mix of servicedDate and servicedPeriod items', () => {
    const items = [
      item({ sequence: 1, servicedDate: '2026-01-10' }),
      item({ sequence: 2, servicedPeriod: { start: '2026-01-05', end: '2026-01-08' } }),
      item({ sequence: 3, servicedDate: '2026-01-20' }),
    ];
    expect(deriveClaimBillablePeriod(items)).toEqual({ start: '2026-01-05', end: '2026-01-20' });
  });

  it('leaves end undefined when no item has an end date', () => {
    const items = [
      item({ sequence: 1, servicedPeriod: { start: '2026-01-01' } }),
      item({ sequence: 2, servicedPeriod: { start: '2026-01-02' } }),
    ];
    expect(deriveClaimBillablePeriod(items)).toEqual({ start: '2026-01-01', end: undefined });
  });
});
