import { describe, expect, it } from 'vitest';
import {
  extractCustomInsuranceOrgIdFromReferenceUrl,
  getCustomInsuranceOrgReferenceUrl,
  isCustomInsuranceOrgReferenceUrl,
  orgIdMatchesReference,
} from './helpers';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('custom insurance organization reference tokens', () => {
  it('round-trips an id through the reference token', () => {
    const url = getCustomInsuranceOrgReferenceUrl(ORG_ID);
    expect(url).toBe(`https://fhir.ottehr.com/billing/custom-insurance-organization/${ORG_ID}`);
    expect(extractCustomInsuranceOrgIdFromReferenceUrl(url)).toBe(ORG_ID);
    expect(isCustomInsuranceOrgReferenceUrl(url)).toBe(true);
  });

  it('does not mistake a payer url or a plain Organization reference for a custom insurance org token', () => {
    expect(isCustomInsuranceOrgReferenceUrl('https://rcm-api.zapehr.com/v1/payer/60054')).toBe(false);
    expect(isCustomInsuranceOrgReferenceUrl(`Organization/${ORG_ID}`)).toBe(false);
    expect(extractCustomInsuranceOrgIdFromReferenceUrl(undefined)).toBeUndefined();
  });

  it('rejects a token with an empty or nested id segment', () => {
    expect(
      extractCustomInsuranceOrgIdFromReferenceUrl('https://fhir.ottehr.com/billing/custom-insurance-organization/')
    ).toBeUndefined();
    expect(
      extractCustomInsuranceOrgIdFromReferenceUrl(
        `https://fhir.ottehr.com/billing/custom-insurance-organization/${ORG_ID}/extra`
      )
    ).toBeUndefined();
  });

  it('matches a custom insurance org reference token by id via orgIdMatchesReference', () => {
    expect(orgIdMatchesReference(getCustomInsuranceOrgReferenceUrl(ORG_ID), ORG_ID)).toBe(true);
    expect(orgIdMatchesReference(getCustomInsuranceOrgReferenceUrl(ORG_ID), 'some-other-id')).toBe(false);
  });
});
