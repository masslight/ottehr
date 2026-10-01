import { ChargeItemDefinition } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { CASE_RATE_CODE, RCM_TAG_SYSTEM } from '../../fhir/constants';
import { chargeMasterEntryNeedsOrgLookup, findChargeMasterEntry, getCaseRateInfo } from './visit-pricing';

// get-charge-master-entry's selection, now a pure function: these pin the behavior the endpoint had inline.
const cm = (
  id: string,
  date: string,
  { status = 'active', orgs = [] as string[], locations = [] as string[] } = {}
): ChargeItemDefinition => ({
  resourceType: 'ChargeItemDefinition',
  id,
  url: `https://example.test/${id}`,
  status: status as ChargeItemDefinition['status'],
  date,
  useContext: [
    ...orgs.map((org) => ({ code: { code: 'payer' }, valueReference: { reference: `Organization/${org}` } })),
    ...locations.map((loc) => ({ code: { code: 'location' }, valueReference: { reference: `Location/${loc}` } })),
  ],
});

describe('findChargeMasterEntry', () => {
  const designated = [
    cm('default-old', '2025-01-01'),
    cm('default-new', '2026-01-01'),
    cm('default-future', '2027-01-01'),
  ];

  it('takes the most recent active designated charge master effective on the date', () => {
    const result = findChargeMasterEntry({
      designation: 'default-insurance',
      cutoffDate: '2026-06-01',
      orgChargeMasters: [],
      designatedChargeMasters: [...designated, cm('default-inactive', '2026-05-01', { status: 'retired' })],
    });
    expect(result).toEqual({ chargeMaster: expect.objectContaining({ id: 'default-new' }), source: 'chargemaster' });
  });

  it('prefers the employer, then the payer, charge master — location-specific first', () => {
    const orgChargeMasters = [
      cm('payer-any', '2026-01-01', { orgs: ['payer-1'] }),
      cm('payer-loc', '2026-01-01', { orgs: ['payer-1'], locations: ['loc-1'] }),
      cm('employer', '2026-01-01', { orgs: ['emp-1'] }),
    ];
    const base = { designation: 'default-insurance' as const, cutoffDate: '2026-06-01', orgChargeMasters };
    expect(
      findChargeMasterEntry({
        ...base,
        payerOrganizationId: 'payer-1',
        employerOrganizationId: 'emp-1',
        designatedChargeMasters: designated,
      }).chargeMaster?.id
    ).toBe('employer');
    expect(
      findChargeMasterEntry({
        ...base,
        payerOrganizationId: 'payer-1',
        locationId: 'loc-1',
        designatedChargeMasters: designated,
      })
    ).toEqual({ chargeMaster: expect.objectContaining({ id: 'payer-loc' }), source: 'payer' });
    expect(
      findChargeMasterEntry({
        ...base,
        payerOrganizationId: 'payer-1',
        locationId: 'loc-2',
        designatedChargeMasters: designated,
      }).chargeMaster?.id
    ).toBe('payer-any');
  });

  it('falls back to the designated charge master when no org charge master applies', () => {
    expect(
      findChargeMasterEntry({
        designation: 'default-insurance',
        payerOrganizationId: 'payer-2',
        cutoffDate: '2026-06-01',
        orgChargeMasters: [cm('payer-1-only', '2026-01-01', { orgs: ['payer-1'] })],
        designatedChargeMasters: designated,
      }).chargeMaster?.id
    ).toBe('default-new');
  });

  it('never looks at org charge masters for self-pay', () => {
    expect(chargeMasterEntryNeedsOrgLookup('self-pay', 'payer-1', 'emp-1')).toBe(false);
    expect(
      findChargeMasterEntry({
        designation: 'self-pay',
        payerOrganizationId: 'payer-1',
        cutoffDate: '2026-06-01',
        orgChargeMasters: [cm('payer', '2026-01-01', { orgs: ['payer-1'] })],
        designatedChargeMasters: [],
      })
    ).toEqual({ chargeMaster: null, source: null });
  });
});

describe('getCaseRateInfo', () => {
  it('reads the flat rate only from a case-rate fee schedule', () => {
    const schedule: ChargeItemDefinition = {
      ...cm('cr', '2026-01-01'),
      propertyGroup: [{ priceComponent: [{ type: 'base', amount: { value: 150 }, code: { text: 'Flat visit' } }] }],
    };
    expect(getCaseRateInfo(schedule)).toBeNull();
    expect(getCaseRateInfo({ ...schedule, meta: { tag: [{ system: RCM_TAG_SYSTEM, code: CASE_RATE_CODE }] } })).toEqual(
      { amount: 150, comment: 'Flat visit' }
    );
  });
});
