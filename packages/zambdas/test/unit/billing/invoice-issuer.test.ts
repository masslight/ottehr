import { Claim, Location, Organization } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { resolveClaimInvoiceIssuer } from '../../../src/billing/invoice-issuer';

const facility: Location = {
  resourceType: 'Location',
  id: 'facility-1',
  name: 'Downtown Urgent Care',
  address: {
    line: ['1 Clinic Way'],
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
  },
};
const billingProvider: Organization = {
  resourceType: 'Organization',
  id: 'provider-1',
  name: 'Acme Medical Group LLC',
};
const claim: Claim = {
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  type: {},
  use: 'claim',
  patient: {
    reference: 'Patient/patient-1',
  },
  created: '2026-10-25',
  priority: {},
  insurance: [],
  provider: {
    reference: 'Organization/provider-1',
  },
  facility: {
    reference: 'Location/facility-1',
  },
};

describe('resolveClaimInvoiceIssuer', () => {
  it("reads the claim's included facility and billing provider", () => {
    expect(resolveClaimInvoiceIssuer(claim, [claim, facility, billingProvider], 'service-facility')).toEqual({
      organization: {
        reference: 'Organization/provider-1',
      },
      name: 'Downtown Urgent Care',
      address: facility.address,
    });
  });

  it('rejects a claim whose facility was not included', () => {
    expect(() => resolveClaimInvoiceIssuer(claim, [claim, billingProvider], 'service-facility')).toThrow();
  });
});
