import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { Account, Coverage, Organization } from 'fhir/r4b';
import { ACCOUNT_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { getCustomInsuranceOrgReferenceUrl } from 'utils/lib/helpers/helpers';
import { CODE_SYSTEM_SERVICE_CATEGORY_CODES } from 'utils/lib/helpers/rcm/constants';
import { describe, expect, it, vi } from 'vitest';
import {
  copyAccount,
  copyCoverageAndSubscriber,
  copyCoverageAndSubscriberForAccount,
  getClaimCoveragesForEncounter,
  resolveCoveragePayors,
} from '../../../src/billing/create-billing-claim-from-encounter/handler';
import { buildCustomInsuranceOrganization } from '../../../src/billing/custom-insurance-org.helpers';
import { payerDisplay, resolvedPayerId } from '../../../src/billing/shared';

// A clinical Coverage paid by a custom insurance organization stores the reference token, never a
// direct Organization reference; the org itself lives in the billing project.
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = getCustomInsuranceOrgReferenceUrl(ORG_ID);
const RCM_PAYER_URL = 'https://rcm-api.zapehr.com/v1/payer/60054';

const billingCustomOrg: Organization = {
  ...buildCustomInsuranceOrganization({
    orgId: 'OTR-ACME',
    name: 'Acme Insurance',
    insuranceTypes: ['auto'],
    submissionMechanism: 'portal',
    acceptedClaimForm: 'cms-1500',
  }),
  id: ORG_ID,
};

const clinicalCoverage: Coverage = {
  resourceType: 'Coverage',
  id: 'coverage-custom',
  status: 'active',
  beneficiary: { reference: 'Patient/patient-123' },
  subscriber: { reference: 'Patient/patient-123' },
  subscriberId: 'MEMBER-1',
  relationship: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship', code: 'self' }] },
  payor: [{ reference: TOKEN }],
  order: 1,
};

const clinicalAccount: Account = {
  resourceType: 'Account',
  id: 'account-123',
  status: 'active',
  type: { coding: [{ system: ACCOUNT_TYPE_CODE_SYSTEM, code: 'PBILLACCT' }] },
  subject: [{ reference: 'Patient/patient-123' }],
  coverage: [{ coverage: { reference: `Coverage/${clinicalCoverage.id}` }, priority: 1 }],
};

const billingOystehr = {
  rcm: { constructPayerUrl: ({ id }: { id: string }) => `https://rcm-api.zapehr.com/v1/payer/${id}` },
} as unknown as Oystehr;

const postedCoverage = (ops: ReturnType<typeof copyCoverageAndSubscriber>[0]): Coverage =>
  ops.find((o): o is BatchInputPostRequest<Coverage> => o.method === 'POST' && o.url === '/Coverage')!.resource;

describe('create-billing-claim-from-encounter — custom insurance organization payor', () => {
  describe('resolveCoveragePayors', () => {
    it('reads a custom insurance org token from the billing project, never RCM or clinical FHIR', async () => {
      const billingGet = vi.fn().mockResolvedValue(billingCustomOrg);
      const clinicalGet = vi.fn();
      const getPayerByUrl = vi.fn();
      const clinical = { fhir: { get: clinicalGet }, rcm: { getPayerByUrl } } as unknown as Oystehr;
      const billing = { fhir: { get: billingGet } } as unknown as Oystehr;

      const payors = await resolveCoveragePayors(clinical, billing, [clinicalCoverage]);

      expect(payors).toEqual([billingCustomOrg]);
      expect(billingGet).toHaveBeenCalledWith({ resourceType: 'Organization', id: ORG_ID });
      expect(getPayerByUrl).not.toHaveBeenCalled();
      expect(clinicalGet).not.toHaveBeenCalled();
    });

    it('still resolves RCM payer urls and Organization references through the clinical client', async () => {
      const rcmPayer: Organization = { resourceType: 'Organization', id: '60054', name: 'Aetna' };
      const clinicalOrg: Organization = { resourceType: 'Organization', id: '22222222-2222-4222-8222-222222222222' };
      const clinicalGet = vi.fn().mockResolvedValue(clinicalOrg);
      const getPayerByUrl = vi.fn().mockResolvedValue(rcmPayer);
      const billingGet = vi.fn();
      const clinical = { fhir: { get: clinicalGet }, rcm: { getPayerByUrl } } as unknown as Oystehr;
      const billing = { fhir: { get: billingGet } } as unknown as Oystehr;

      const payors = await resolveCoveragePayors(clinical, billing, [
        { ...clinicalCoverage, payor: [{ reference: RCM_PAYER_URL }] },
        { ...clinicalCoverage, payor: [{ reference: `Organization/${clinicalOrg.id}` }] },
      ]);

      expect(payors).toEqual([rcmPayer, clinicalOrg]);
      expect(getPayerByUrl).toHaveBeenCalledWith({ url: RCM_PAYER_URL });
      expect(clinicalGet).toHaveBeenCalledWith({ resourceType: 'Organization', id: clinicalOrg.id });
      expect(billingGet).not.toHaveBeenCalled();
    });
  });

  describe('copyCoverageAndSubscriber', () => {
    it('rewrites the token to the billing-side Organization reference with a "Name (OTR id)" display', () => {
      const [ops] = copyCoverageAndSubscriber(billingOystehr, clinicalCoverage, 'urn:uuid:patient', [billingCustomOrg]);

      expect(postedCoverage(ops).payor).toEqual([
        { reference: `Organization/${ORG_ID}`, display: 'Acme Insurance (OTR-ACME)' },
      ]);
      // Sanity-check the display comes from the shared billing helpers, not a hand-built string.
      expect(payerDisplay(billingCustomOrg)).toBe('Acme Insurance (OTR-ACME)');
      expect(resolvedPayerId(billingCustomOrg)).toBe('OTR-ACME');
    });

    it('keeps the reference when the payor could not be matched, instead of leaving the clinical token', () => {
      const [ops] = copyCoverageAndSubscriber(billingOystehr, clinicalCoverage, 'urn:uuid:patient', []);

      expect(postedCoverage(ops).payor).toEqual([{ reference: `Organization/${ORG_ID}`, display: undefined }]);
    });

    it('carries the billing Organization reference through the working copy onto the claim insurer', () => {
      const [ops] = copyCoverageAndSubscriberForAccount(
        billingOystehr,
        [clinicalCoverage],
        clinicalAccount,
        'urn:uuid:patient',
        [billingCustomOrg]
      );
      const billingCoverage = postedCoverage(ops);
      const accountCopy = copyAccount(clinicalAccount, 'urn:uuid:patient', [billingCoverage]);

      const [claimOps] = copyCoverageAndSubscriber(
        billingOystehr,
        billingCoverage,
        'urn:uuid:claim-patient',
        [billingCustomOrg],
        undefined,
        true
      );
      const claimCoverage = postedCoverage(claimOps);
      expect(claimCoverage.payor).toEqual([
        { reference: `Organization/${ORG_ID}`, display: 'Acme Insurance (OTR-ACME)' },
      ]);

      const [coverageRef] = getClaimCoveragesForEncounter(
        CODE_SYSTEM_SERVICE_CATEGORY_CODES['urgent-care'],
        [accountCopy],
        [claimCoverage]
      );
      expect(coverageRef.payorRef).toEqual({
        reference: `Organization/${ORG_ID}`,
        display: 'Acme Insurance (OTR-ACME)',
      });
      expect(coverageRef.coverageRef.display).toBe('Acme Insurance (OTR-ACME)');
    });
  });
});
