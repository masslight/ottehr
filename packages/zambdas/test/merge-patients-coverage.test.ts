import { Account, Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getCoverageIdsToCancel, getCoveragePriorities } from '../src/ehr/merge-patients/perform';

const coverage = (
  id: string,
  order: number | undefined,
  memberId: string,
  payor: string,
  status = 'active'
): Coverage => ({
  resourceType: 'Coverage',
  id,
  status: status as Coverage['status'],
  order,
  beneficiary: { reference: `Patient/${id}` },
  payor: [{ reference: payor }],
  subscriberId: memberId,
});

describe('getCoverageIdsToCancel', () => {
  const mainPrimary = coverage('a1', 1, 'MEMBER-A', 'Organization/3m');

  it('cancels a non-duplicate coverage competing for a slot the main patient already fills', () => {
    const other = coverage('b1', 1, 'MEMBER-B', 'Organization/1199');
    expect([...getCoverageIdsToCancel([other], [mainPrimary])]).toEqual(['b1']);
  });

  it('cancels a duplicate of a main coverage even in a different slot', () => {
    const dup = coverage('b1', 2, 'MEMBER-A', 'Organization/3m');
    expect([...getCoverageIdsToCancel([dup], [mainPrimary])]).toEqual(['b1']);
  });

  it('keeps a coverage for a slot the main patient does not fill', () => {
    const secondary = coverage('b2', 2, 'MEMBER-B', 'Organization/1199');
    expect(getCoverageIdsToCancel([secondary], [mainPrimary]).size).toBe(0);
  });

  it('keeps everything when the main patient has no active coverage', () => {
    const other = coverage('b1', 1, 'MEMBER-B', 'Organization/1199');
    expect(getCoverageIdsToCancel([other], []).size).toBe(0);
  });

  it('ignores already inactive coverages', () => {
    const old = coverage('b1', 1, 'MEMBER-B', 'Organization/1199', 'cancelled');
    expect(getCoverageIdsToCancel([old], [mainPrimary]).size).toBe(0);
  });

  it('uses Account priority for the slot when Coverage.order is not set', () => {
    const main = coverage('a1', undefined, 'MEMBER-A', 'Organization/3m');
    const other = coverage('b1', undefined, 'MEMBER-B', 'Organization/1199');
    const accounts: Account[] = [
      {
        resourceType: 'Account',
        status: 'active',
        coverage: [{ coverage: { reference: 'Coverage/a1' }, priority: 1 }],
      },
      {
        resourceType: 'Account',
        status: 'active',
        coverage: [{ coverage: { reference: 'Coverage/b1' }, priority: 1 }],
      },
    ];
    const priorities = getCoveragePriorities(accounts);
    expect([...getCoverageIdsToCancel([other], [main], priorities)]).toEqual(['b1']);
  });

  it('keeps a secondary-slot coverage from the merged-away patient when main only has a primary', () => {
    const main = coverage('a1', undefined, 'MEMBER-A', 'Organization/3m');
    const other = coverage('b1', undefined, 'MEMBER-B', 'Organization/1199');
    const priorities = new Map([
      ['a1', 1],
      ['b1', 2],
    ]);
    expect(getCoverageIdsToCancel([other], [main], priorities).size).toBe(0);
  });
});
