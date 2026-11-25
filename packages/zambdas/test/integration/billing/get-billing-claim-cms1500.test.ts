import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, Coverage, FhirResource, Location, Organization, Patient, PaymentNotice, Practitioner } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { Cms1500FormData } from 'utils/lib/types/data/billing/cms1500.types';
import {
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('get-billing-claim-cms1500', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  const encounterId = randomUUID();
  let seeded: FhirResource[] = [];
  let claim: Claim;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-claim-cms1500.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:patient',
        resource: tagged<Patient>({
          resourceType: 'Patient',
          name: [{ family: `Formfill${unique}`, given: ['Fiona'] }],
          birthDate: '1979-08-21',
          gender: 'female',
          address: [{ line: ['5 Elm St'], city: 'Boston', state: 'MA', postalCode: '02108' }],
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:payer',
        resource: tagged<Organization>({
          resourceType: 'Organization',
          name: `Form Payer ${unique}`,
          type: [{ coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: CUSTOM_INSURANCE_ORG_KIND_CODE }] }],
          identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: `OTR-${unique}` }],
          address: [{ line: ['PO Box 100'], city: 'Hartford', state: 'CT', postalCode: '06101' }],
        }),
      },
      {
        method: 'POST',
        url: '/Coverage',
        fullUrl: 'urn:uuid:coverage',
        resource: tagged<Coverage>({
          resourceType: 'Coverage',
          status: 'active',
          subscriberId: `CMS-${unique}`,
          beneficiary: { reference: 'urn:uuid:patient' },
          subscriber: { reference: 'urn:uuid:patient' },
          payor: [{ reference: 'urn:uuid:payer' }],
          relationship: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship', code: 'self' }],
          },
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:billing-provider',
        resource: tagged<Organization>({ resourceType: 'Organization', name: `Form Billing Group ${unique}` }),
      },
      {
        method: 'POST',
        url: '/Practitioner',
        fullUrl: 'urn:uuid:rendering',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          name: [{ family: `Renderer${unique}`, given: ['Rita'] }],
          identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
        }),
      },
      {
        method: 'POST',
        url: '/Practitioner',
        fullUrl: 'urn:uuid:referring',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          name: [{ family: `Referrer${unique}`, given: ['Ray'], suffix: ['MD'] }],
          identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1245319599' }],
        }),
      },
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:facility',
        resource: tagged<Location>({ resourceType: 'Location', status: 'active', name: `Form Clinic ${unique}` }),
      },
      {
        method: 'POST',
        url: '/Claim',
        resource: tagged<Claim>({
          resourceType: 'Claim',
          status: 'draft',
          use: 'claim',
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
          identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
          patient: { reference: 'urn:uuid:patient' },
          created: '2026-02-10',
          provider: { reference: 'urn:uuid:billing-provider' },
          facility: { reference: 'urn:uuid:facility' },
          insurer: { reference: 'urn:uuid:payer' },
          careTeam: [
            { sequence: 1, provider: { reference: 'urn:uuid:rendering' } },
            {
              sequence: 2,
              provider: { reference: 'urn:uuid:referring' },
              role: { coding: [{ code: 'DN' }] },
            },
          ],
          priority: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
          },
          insurance: [{ sequence: 1, focal: true, coverage: { reference: 'urn:uuid:coverage' } }],
          diagnosis: [
            {
              sequence: 1,
              diagnosisCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'J02.9' }] },
            },
          ],
          item: [
            {
              sequence: 1,
              diagnosisSequence: [1],
              productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }] },
              servicedPeriod: { start: '2026-02-10' },
              net: { value: 175, currency: 'USD' },
              quantity: { value: 1 },
            },
          ],
          total: { value: 175, currency: 'USD' },
        }),
      },
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: tagged<PaymentNotice>({
          resourceType: 'PaymentNotice',
          status: 'active',
          request: { identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId } },
          identifier: [{ system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() }],
          created: '2026-02-10T15:00:00.000Z',
          paymentDate: '2026-02-10',
          payment: { display: 'Copay' },
          recipient: { display: 'Form Billing Group' },
          amount: { value: 40, currency: 'USD' },
        }),
      },
    ];
    seeded = (await billing.fhir.transaction<FhirResource>({ requests })).entry!.map((entry) => entry.resource!);
    claim = seeded.find((resource): resource is Claim => resource.resourceType === 'Claim')!;
  }, 60_000);

  afterAll(async () => {
    await admin.fhir
      .batch({
        requests: seeded
          .reverse()
          .map((resource) => ({ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` })),
      })
      .catch((error) => console.error('get-billing-claim-cms1500 cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('fills the form from the claim graph, its resolved payer, the referring provider and the patient payments', async () => {
    const form = (await billing.zambda.execute({ id: 'get-billing-claim-cms1500', claimId: claim.id }))
      .output as Cms1500FormData;

    expect(form.payer).toEqual({
      name: `Form Payer ${unique}`,
      address: { line1: 'PO Box 100', city: 'Hartford', state: 'CT', postalCode: '06101' },
    });
    expect(form.insuredPlanName).toBe(`Form Payer ${unique}`);
    expect(form.referringProvider).toEqual({
      qualifier: 'DN',
      name: { last: `Referrer${unique}`, first: 'Ray', suffix: 'MD' },
      credentials: 'MD',
      npi: '1245319599',
    });
    expect(form.amountPaid).toBe(40);
    expect(form.insuredId).toBe(`CMS-${unique}`);
    expect(form.patientName).toEqual({ last: `Formfill${unique}`, first: 'Fiona' });
    expect(form.patientBirthDate).toBe('1979-08-21');
    expect(form.patientRelationshipToInsured).toBe('self');
    expect(form.diagnosisCodes).toEqual(['J02.9']);
  }, 60_000);
});
