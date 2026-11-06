import { Account, Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getCoverageIdsToCancel, getCoverageSlots } from '../src/ehr/merge-patients/perform';

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
    const slots = getCoverageSlots(accounts);
    expect([...getCoverageIdsToCancel([other], [main], slots)]).toEqual(['b1']);
  });

  it('keeps a secondary-slot coverage from the merged-away patient when main only has a primary', () => {
    const main = coverage('a1', undefined, 'MEMBER-A', 'Organization/3m');
    const other = coverage('b1', undefined, 'MEMBER-B', 'Organization/1199');
    const slots = new Map([
      ['a1', 'PBILLACCT:1'],
      ['b1', 'PBILLACCT:2'],
    ]);
    expect(getCoverageIdsToCancel([other], [main], slots).size).toBe(0);
  });

  it('ignores inactive accounts when deriving priorities', () => {
    const accounts: Account[] = [
      {
        resourceType: 'Account',
        status: 'inactive',
        coverage: [{ coverage: { reference: 'Coverage/a1' }, priority: 2 }],
      },
      {
        resourceType: 'Account',
        status: 'active',
        coverage: [{ coverage: { reference: 'Coverage/a1' }, priority: 1 }],
      },
    ];
    expect(getCoverageSlots(accounts).get('a1')).toBe(':1');
  });

  it('compares priorities only within the same Account type', () => {
    const main = coverage('a1', undefined, 'MEMBER-A', 'Organization/3m');
    const workersComp = coverage('b1', undefined, 'MEMBER-B', 'Organization/1199');
    const typed = (code: string, id: string): Account => ({
      resourceType: 'Account',
      status: 'active',
      type: { coding: [{ code }] },
      coverage: [{ coverage: { reference: `Coverage/${id}` }, priority: 1 }],
    });
    const slots = getCoverageSlots([typed('PBILLACCT', 'a1'), typed('WCOMPACCT', 'b1')]);
    expect(getCoverageIdsToCancel([workersComp], [main], slots).size).toBe(0);
    // same type, same priority still conflicts
    const sameType = getCoverageSlots([typed('WCOMPACCT', 'a1'), typed('WCOMPACCT', 'b1')]);
    expect([...getCoverageIdsToCancel([workersComp], [main], sameType)]).toEqual(['b1']);
  });
});
