import { Coverage, Organization } from 'fhir/r4b';
import { getCustomInsuranceOrgReferenceUrl } from 'utils/lib/helpers/helpers';
import { CUSTOM_INSURANCE_ORG_ID_SYSTEM } from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { describe, expect, it } from 'vitest';
import { coverageHasCustomInsuranceOrgPayor, getPayorRef } from '../../src/patient/get-eligibility/helpers';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = getCustomInsuranceOrgReferenceUrl(ORG_ID);

const customOrg: Organization = {
  resourceType: 'Organization',
  id: ORG_ID,
  name: 'Acme Insurance',
  identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }],
};
const rcmPayer: Organization = { resourceType: 'Organization', id: '60054', name: 'Aetna' };

const coverageWithPayor = (reference: string): Coverage => ({
  resourceType: 'Coverage',
  id: 'coverage-1',
  status: 'active',
  beneficiary: { reference: 'Patient/patient-123' },
  payor: [{ reference }],
});

describe('get-eligibility — custom insurance organizations', () => {
  it('never builds an RCM payer url from a custom insurance org token', () => {
    // findOrgMatchingReference does match the token to the org, so without the guard this would
    // become https://rcm-api.zapehr.com/v1/payer/<custom org uuid>.
    expect(getPayorRef(coverageWithPayor(TOKEN), [customOrg])).toBeUndefined();
  });

  it('flags a custom insurance org coverage so the handler reports it as not checked', () => {
    expect(coverageHasCustomInsuranceOrgPayor(coverageWithPayor(TOKEN))).toBe(true);
    expect(coverageHasCustomInsuranceOrgPayor(coverageWithPayor('https://rcm-api.zapehr.com/v1/payer/60054'))).toBe(
      false
    );
    expect(coverageHasCustomInsuranceOrgPayor(coverageWithPayor(`Organization/${ORG_ID}`))).toBe(false);
  });

  it('still returns the RCM payer url for an RCM payer coverage', () => {
    expect(getPayorRef(coverageWithPayor('https://rcm-api.zapehr.com/v1/payer/60054'), [customOrg, rcmPayer])).toBe(
      'https://rcm-api.zapehr.com/v1/payer/60054'
    );
  });
});
