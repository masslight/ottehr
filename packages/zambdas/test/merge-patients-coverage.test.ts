import { Account, Coverage } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { getCoverageIdsToCancel, getCoverageSlots, planBillingConsolidation } from '../src/ehr/merge-patients/perform';

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

  it('cancels a secondary coverage when main already has a primary of the same type', () => {
    const secondary = coverage('b2', 2, 'MEMBER-B', 'Organization/1199');
    expect([...getCoverageIdsToCancel([secondary], [mainPrimary])]).toEqual(['b2']);
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

  it('cancels primary and secondary of the merged-away patient when main only has a primary', () => {
    const main = coverage('a1', undefined, 'MEMBER-A', 'Organization/3m');
    const other = coverage('b1', undefined, 'MEMBER-B', 'Organization/3m-x');
    const other2 = coverage('b2', undefined, 'MEMBER-C', 'Organization/aarp');
    const slots = new Map([
      ['a1', 'PBILLACCT:1'],
      ['b1', 'PBILLACCT:1'],
      ['b2', 'PBILLACCT:2'],
    ]);
    expect([...getCoverageIdsToCancel([other, other2], [main], slots)].sort()).toEqual(['b1', 'b2']);
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

describe('planBillingConsolidation', () => {
  const OLD = 'Patient/old';
  const MAIN = 'Patient/main';
  const BILL = { coding: [{ code: 'PBILLACCT' }] };
  const WORK = { coding: [{ code: 'WCOMPACCT' }] };

  const cov = (id: string, memberId: string, payor: string, beneficiary = OLD): Coverage => ({
    resourceType: 'Coverage',
    id,
    status: 'active',
    beneficiary: { reference: beneficiary },
    subscriber: { reference: beneficiary },
    payor: [{ reference: payor }],
    subscriberId: memberId,
  });
  const account = (
    id: string,
    patient: string,
    type: Account['type'],
    coverages: [string, number][],
    extra: Partial<Account> = {}
  ): Account => ({
    resourceType: 'Account',
    id,
    status: 'active',
    type,
    subject: [{ reference: patient }],
    coverage: coverages.map(([c, priority]) => ({ coverage: { reference: `Coverage/${c}` }, priority })),
    ...extra,
  });
  const plan = (
    input: Partial<Parameters<typeof planBillingConsolidation>[0]>
  ): ReturnType<typeof planBillingConsolidation> =>
    planBillingConsolidation({
      oldPatientRef: OLD,
      newPatientRef: MAIN,
      oldAccounts: [],
      mainAccounts: [],
      oldCoverages: [],
      mainActiveCoverages: [],
      processedIds: new Set(),
      ...input,
    });
  const putById = (requests: { url?: string; resource?: any }[], url: string): any =>
    requests.find((r) => r.url === url)?.resource;

  it('drops both primary and secondary of the merged-away patient when main already has a primary', () => {
    const mainCov = cov('a1', 'MEMBER-A', 'Organization/1199', MAIN);
    const { requests, accountIdRedirects } = plan({
      mainAccounts: [account('acc-main', MAIN, BILL, [['a1', 1]])],
      oldAccounts: [
        account('acc-old', OLD, BILL, [
          ['b1', 1],
          ['b2', 2],
        ]),
      ],
      mainActiveCoverages: [mainCov],
      oldCoverages: [cov('b1', 'MEMBER-B1', 'Organization/3m'), cov('b2', 'MEMBER-B2', 'Organization/aarp')],
    });

    expect(putById(requests, '/Account/acc-main').coverage.map((c: any) => c.coverage.reference)).toEqual([
      'Coverage/a1',
    ]);
    expect(putById(requests, '/Account/acc-old').status).toBe('inactive');
    expect(accountIdRedirects.get('acc-old')).toBe('acc-main');
    for (const id of ['b1', 'b2']) {
      const moved = putById(requests, `/Coverage/${id}`);
      expect(moved.status).toBe('cancelled');
      expect(moved.beneficiary.reference).toBe(MAIN);
      expect(moved.subscriber.reference).toBe(MAIN);
    }
  });

  it('carries the merged-away coverages over when main has none', () => {
    const { requests } = plan({
      mainAccounts: [account('acc-main', MAIN, BILL, [])],
      oldAccounts: [
        account('acc-old', OLD, BILL, [
          ['b1', 1],
          ['b2', 2],
        ]),
      ],
      oldCoverages: [cov('b1', 'MEMBER-B1', 'Organization/3m'), cov('b2', 'MEMBER-B2', 'Organization/aarp')],
    });
    expect(putById(requests, '/Account/acc-main').coverage).toHaveLength(2);
    expect(putById(requests, '/Coverage/b1').status).toBe('active');
    expect(putById(requests, '/Coverage/b1').beneficiary.reference).toBe(MAIN);
  });

  it('keeps workers comp coverage when main only has a billing coverage', () => {
    const { requests } = plan({
      mainAccounts: [account('acc-main', MAIN, BILL, [['a1', 1]])],
      oldAccounts: [account('acc-old-wc', OLD, WORK, [['w1', 1]])],
      mainActiveCoverages: [cov('a1', 'MEMBER-A', 'Organization/1199', MAIN)],
      oldCoverages: [cov('w1', 'MEMBER-W', 'Organization/wc')],
    });
    expect(putById(requests, '/Coverage/w1').status).toBe('active');
    // no main WCOMPACCT to merge into: the old account is just re-pointed to main
    expect(putById(requests, '/Account/acc-old-wc').subject[0].reference).toBe(MAIN);
    expect(putById(requests, '/Account/acc-old-wc').status).toBe('active');
    expect(putById(requests, '/Account/acc-main')).toBeUndefined();
  });

  it('re-points the old account guarantor when there is no matching main account', () => {
    const old = account('acc-old', OLD, BILL, [], { guarantor: [{ party: { reference: OLD } }] });
    const { requests } = plan({ oldAccounts: [old] });
    const put = putById(requests, '/Account/acc-old');
    expect(put.subject[0].reference).toBe(MAIN);
    expect(put.guarantor[0].party.reference).toBe(MAIN);
  });

  it('does not touch an old account that already references main', () => {
    const { requests } = plan({ oldAccounts: [account('acc-old', MAIN, BILL, [])] });
    expect(requests).toHaveLength(0);
  });

  it('does not consolidate an inactive old account into main', () => {
    const inactive = account('acc-old', OLD, BILL, [['b1', 1]], { status: 'inactive' });
    const { requests, accountIdRedirects } = plan({
      mainAccounts: [account('acc-main', MAIN, BILL, [['a1', 1]])],
      oldAccounts: [inactive],
    });
    expect(accountIdRedirects.size).toBe(0);
    expect(putById(requests, '/Account/acc-old').subject[0].reference).toBe(MAIN);
    expect(putById(requests, '/Account/acc-main')).toBeUndefined();
  });

  it('copies a contained guarantor from the old account when main has none', () => {
    const contained = [{ resourceType: 'RelatedPerson', id: 'g1' }] as Account['contained'];
    const old = account('acc-old', OLD, BILL, [], {
      guarantor: [{ party: { reference: '#g1' } }, { party: { reference: OLD } }],
      contained,
    });
    const { requests } = plan({
      mainAccounts: [account('acc-main', MAIN, BILL, [])],
      oldAccounts: [old],
    });
    const main = putById(requests, '/Account/acc-main');
    expect(main.contained.map((c: any) => c.id)).toEqual(['g1']);
    expect(main.guarantor.map((g: any) => g.party.reference)).toEqual(['#g1', MAIN]);
  });

  it('keeps the main guarantor and renames a clashing contained id', () => {
    const mainWithGuarantor = account('acc-main', MAIN, BILL, [], {
      guarantor: [{ party: { reference: '#g1' } }],
      contained: [{ resourceType: 'RelatedPerson', id: 'g1' }] as Account['contained'],
    });
    const mainNoGuarantor = account('acc-main2', MAIN, WORK, [], {
      contained: [{ resourceType: 'RelatedPerson', id: 'g1' }] as Account['contained'],
    });
    const oldBill = account('acc-old', OLD, BILL, [], { guarantor: [{ party: { reference: '#g2' } }] });
    const oldWork = account('acc-old2', OLD, WORK, [], {
      guarantor: [{ party: { reference: '#g1' } }],
      contained: [{ resourceType: 'RelatedPerson', id: 'g1' }] as Account['contained'],
    });
    const { requests } = plan({ mainAccounts: [mainWithGuarantor, mainNoGuarantor], oldAccounts: [oldBill, oldWork] });
    expect(putById(requests, '/Account/acc-main').guarantor[0].party.reference).toBe('#g1');
    const merged = putById(requests, '/Account/acc-main2');
    expect(merged.contained.map((c: any) => c.id)).toEqual(['g1', 'g1-1']);
    expect(merged.guarantor[0].party.reference).toBe('#g1-1');
  });

  it('skips resources that were already processed', () => {
    const { requests } = plan({
      oldAccounts: [account('acc-old', OLD, BILL, [])],
      oldCoverages: [cov('b1', 'MEMBER-B', 'Organization/3m')],
      processedIds: new Set(['Account/acc-old', 'Coverage/b1']),
    });
    expect(requests).toHaveLength(0);
  });

  it('does not rewrite a coverage that needs no change', () => {
    const { requests } = plan({ oldCoverages: [cov('b1', 'MEMBER-B', 'Organization/3m', 'Patient/other')] });
    expect(requests).toHaveLength(0);
  });
});
