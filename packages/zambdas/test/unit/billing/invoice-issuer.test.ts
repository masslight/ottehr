import { Claim, Location, Organization } from 'fhir/r4b';
import { InvoiceIssuer, isSameInvoiceIssuer } from 'utils/lib/fhir/billing-invoice';
import { INVOICE_ISSUER_SOURCES } from 'utils/lib/types/constants';
import { describe, expect, it } from 'vitest';
import { resolveClaimInvoiceIssuer } from '../../../src/billing/invoice-issuer';
import { prepareWorkingCopy } from '../../../src/billing/shared';

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

  it.each(INVOICE_ISSUER_SOURCES)(
    'gives claims with their own working copies of one billing provider the same %s issuer',
    (source) => {
      const workingCopyFor = (id: string): Organization => ({
        ...prepareWorkingCopy<Organization>(
          {
            ...billingProvider,
            address: [facility.address!],
          },
          billingProvider.id
        ),
        id,
      });
      const issuerFor = (copy: Organization): InvoiceIssuer =>
        resolveClaimInvoiceIssuer(
          {
            ...claim,
            provider: {
              reference: `Organization/${copy.id}`,
            },
          },
          [facility, copy],
          source
        );

      const first = issuerFor(workingCopyFor('provider-copy-1'));
      const second = issuerFor(workingCopyFor('provider-copy-2'));

      expect(first.organization).toEqual({
        reference: 'Organization/provider-1',
      });
      expect(isSameInvoiceIssuer(first, second)).toBe(true);
    }
  );

  it('rejects a claim whose facility was not included', () => {
    expect(() => resolveClaimInvoiceIssuer(claim, [claim, billingProvider], 'service-facility')).toThrow();
  });
});
