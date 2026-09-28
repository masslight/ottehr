import { Coverage, Organization } from 'fhir/r4b';
import { findOrgMatchingReference, getCustomInsuranceOrgReferenceUrl } from 'utils/lib/helpers/helpers';
import { CUSTOM_INSURANCE_ORG_ID_SYSTEM } from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { describe, expect, it } from 'vitest';
import { findCandidCoveragePayer } from '../../src/shared/candid';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = getCustomInsuranceOrgReferenceUrl(ORG_ID);

// The stand-in harvest's searchInsuranceInformation resolves a token into (see
// custom-insurance-org-directory.ts): no RCM payer id, just a name and the "OTR-" business id.
const customOrg: Organization = {
  resourceType: 'Organization',
  id: ORG_ID,
  name: 'Acme Insurance',
  identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }],
};

const rcmPayer: Organization = {
  resourceType: 'Organization',
  id: 'rcm-payer-60054',
  name: 'Aetna',
  identifier: [{ system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id', value: '60054' }],
};

const coverageWithPayor = (reference: string): Coverage => ({
  resourceType: 'Coverage',
  id: 'coverage-1',
  status: 'active',
  beneficiary: { reference: 'Patient/patient-123' },
  payor: [{ reference }],
});

describe('Candid sync — custom insurance organizations', () => {
  it('leaves a custom insurance org coverage out of the Candid coverage sync, since Candid needs an RCM payer id', () => {
    expect(findCandidCoveragePayer(coverageWithPayor(TOKEN), [customOrg, rcmPayer])).toBeUndefined();
  });

  it('still matches RCM payer urls and Organization references', () => {
    expect(
      findCandidCoveragePayer(coverageWithPayor('https://rcm-api.zapehr.com/v1/payer/60054'), [customOrg, rcmPayer])
    ).toBe(rcmPayer);
    expect(findCandidCoveragePayer(coverageWithPayor(`Organization/${ORG_ID}`), [customOrg, rcmPayer])).toBe(customOrg);
    expect(findCandidCoveragePayer(undefined, [customOrg, rcmPayer])).toBeUndefined();
  });

  it('resolves the token for Candid encounter creation, which looks up contracts by payer name only', () => {
    // createCandidCreateEncounterInput matches the primary Coverage's payor with findOrgMatchingReference
    // and rejects the visit as MISSING_PATIENT_COVERAGE_INFO when nothing matches.
    expect(findOrgMatchingReference(TOKEN, [rcmPayer, customOrg])).toBe(customOrg);
  });
});
