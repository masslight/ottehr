import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Claim,
  ClaimResponse,
  Coverage,
  FhirResource,
  Location,
  Organization,
  Patient,
  PaymentNotice,
  PaymentReconciliation,
  Person,
  Practitioner,
  RelatedPerson,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { claimNonInsurancePayerExtension } from 'utils/lib/fhir/billing';
import { NIO_INVOICE_PAYMENT_ID_SYSTEM } from 'utils/lib/fhir/billing-invoice';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  ManualEraBillingProviderAndPayer,
} from '../../../src/billing/manual-era';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { setTaxId } from '../../../src/billing/shared';
import { WRITE_OFF_PARTY_EXT_URL, WRITE_OFF_REASON_EXT_URL, WRITE_OFF_SYSTEM } from '../../../src/billing/write-offs';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('get-billing-claim-detail', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  const encounterId = randomUUID();
  let seeded: FhirResource[] = [];
  let claim: Claim;
  let otherClaim: Claim;
  let patient: Patient;
  let payer: Organization;
  let nonInsurancePayer: Organization;
  let coverage: Coverage;
  let billingProvider: Organization;
  let facility: Location;
  let renderingProvider: Practitioner;
  let era: PaymentReconciliation;
  let remit: ClaimResponse;
  let submission: ClaimResponse;
  let writeOff: PaymentNotice;
  let patientPayment: PaymentNotice;
  let nioPayment: PaymentNotice;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const ofType = <T extends FhirResource>(resources: FhirResource[], resourceType: T['resourceType']): T[] =>
    resources.filter((resource): resource is T => resource.resourceType === resourceType);
  const claimBase = {
    resourceType: 'Claim' as const,
    // not active, so the ERA-match subscription (request.status=active) leaves the claim alone
    status: 'draft' as const,
    use: 'claim' as const,
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-claim-detail.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const billingGroup: Organization = {
      resourceType: 'Organization',
      name: `Detail Billing Group ${unique}`,
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
    };
    setTaxId(billingGroup, '123456789');
    const graphRequests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:patient',
        resource: tagged<Patient>({
          resourceType: 'Patient',
          name: [{ family: `Detail${unique}`, given: ['Dana'] }],
          birthDate: '1988-06-15',
          gender: 'female',
          address: [{ line: ['9 Pine St'], city: 'Denver', state: 'CO', postalCode: '80202' }],
        }),
      },
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:linked-patient',
        resource: tagged<Patient>({ resourceType: 'Patient', name: [{ family: `Detail${unique}`, given: ['Dana'] }] }),
      },
      {
        method: 'POST',
        url: '/Person',
        resource: tagged<Person>({
          resourceType: 'Person',
          link: [{ target: { reference: 'urn:uuid:patient' } }, { target: { reference: 'urn:uuid:linked-patient' } }],
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:payer',
        resource: tagged<Organization>({
          resourceType: 'Organization',
          name: `Detail Payer ${unique}`,
          type: [{ coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: CUSTOM_INSURANCE_ORG_KIND_CODE }] }],
          identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: `OTR-${unique}` }],
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:nio',
        resource: tagged<Organization>({ resourceType: 'Organization', name: `Detail Employer ${unique}` }),
      },
      {
        method: 'POST',
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:subscriber',
        resource: tagged<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: 'urn:uuid:patient' },
          name: [{ family: `Holder${unique}`, given: ['Hal'] }],
          birthDate: '1980-01-20',
          gender: 'male',
        }),
      },
      {
        method: 'POST',
        url: '/Coverage',
        fullUrl: 'urn:uuid:coverage',
        resource: tagged<Coverage>({
          resourceType: 'Coverage',
          status: 'active',
          subscriberId: `DET-${unique}`,
          beneficiary: { reference: 'urn:uuid:patient' },
          subscriber: { reference: 'urn:uuid:subscriber' },
          payor: [{ reference: 'urn:uuid:payer' }],
        }),
      },
      { method: 'POST', url: '/Organization', fullUrl: 'urn:uuid:billing-provider', resource: tagged(billingGroup) },
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:facility',
        resource: tagged<Location>({
          resourceType: 'Location',
          status: 'active',
          name: `Detail Clinic ${unique}`,
          address: { line: ['1 Clinic Way'], city: 'Denver', state: 'CO', postalCode: '80203' },
        }),
      },
      {
        method: 'POST',
        url: '/Practitioner',
        fullUrl: 'urn:uuid:rendering',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          name: [{ family: `Renderer${unique}`, given: ['Rita'] }],
          identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1245319599' }],
        }),
      },
      {
        method: 'POST',
        url: '/Claim',
        fullUrl: 'urn:uuid:claim',
        resource: tagged<Claim>({
          ...claimBase,
          identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
          patient: { reference: 'urn:uuid:patient' },
          created: '2026-03-01',
          provider: { reference: 'urn:uuid:billing-provider' },
          facility: { reference: 'urn:uuid:facility' },
          careTeam: [{ sequence: 1, provider: { reference: 'urn:uuid:rendering' } }],
          insurer: { reference: 'urn:uuid:payer' },
          insurance: [{ sequence: 1, focal: true, coverage: { reference: 'urn:uuid:coverage' } }],
          extension: [claimNonInsurancePayerExtension({ reference: 'urn:uuid:nio', display: 'Stale employer name' })],
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
              productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99214' }] },
              servicedPeriod: { start: '2026-03-01' },
              net: { value: 200, currency: 'USD' },
              quantity: { value: 1 },
            },
          ],
          total: { value: 200, currency: 'USD' },
        }),
      },
      {
        method: 'POST',
        url: '/Claim',
        resource: tagged<Claim>({
          ...claimBase,
          patient: { reference: 'urn:uuid:linked-patient' },
          created: '2026-01-15',
          provider: { display: 'Unknown' },
          insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
          item: [
            {
              sequence: 1,
              productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99212' }] },
              servicedPeriod: { start: '2026-01-15' },
              net: { value: 90, currency: 'USD' },
            },
          ],
          total: { value: 90, currency: 'USD' },
        }),
      },
    ];
    const graph = (await billing.fhir.transaction<FhirResource>({ requests: graphRequests })).entry!.map(
      (entry) => entry.resource!
    );
    seeded.push(...graph);
    [patient] = ofType<Patient>(graph, 'Patient');
    [payer, nonInsurancePayer, billingProvider] = ofType<Organization>(graph, 'Organization');
    [coverage] = ofType<Coverage>(graph, 'Coverage');
    [facility] = ofType<Location>(graph, 'Location');
    [renderingProvider] = ofType<Practitioner>(graph, 'Practitioner');
    [claim, otherClaim] = ofType<Claim>(graph, 'Claim');

    const header: ManualEraHeader = {
      payerId: payer.id!,
      billingProviderRef: `Organization/${billingProvider.id}`,
      checkNumber: `DET-CHK-${unique}`,
      checkAmountCents: 12000,
      remitDate: '2026-03-12',
      checkDate: '2026-03-11',
    };
    const billingProviderAndPayer: ManualEraBillingProviderAndPayer = {
      payer: { reference: `Organization/${payer.id}`, display: payer.name! },
      billingProvider: { reference: `Organization/${billingProvider.id}`, name: billingProvider.name! },
    };
    const paymentsRequests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/PaymentReconciliation',
        fullUrl: 'urn:uuid:era',
        resource: tagged(
          buildManualPaymentReconciliation({
            header,
            billingProviderAndPayer,
            created: '2026-03-12T12:00:00.000Z',
            editedAt: '2026-03-12T12:00:00.000Z',
          })
        ),
      },
      {
        method: 'POST',
        url: '/ClaimResponse',
        fullUrl: 'urn:uuid:remit',
        resource: tagged(
          buildManualClaimResponse({
            claim: {
              statusCode: '1',
              patientName: `Dana Detail${unique}`,
              serviceLines: [
                {
                  itemSequence: 1,
                  serviceDate: '2026-03-01',
                  procedureCode: '99214',
                  billedCents: 20000,
                  allowedCents: 18000,
                  paidCents: 12000,
                  adjustments: [
                    { groupCode: 'CO', reasonCode: '45', amountCents: 2000 },
                    { groupCode: 'PR', reasonCode: '2', amountCents: 6000 },
                  ],
                  remarkCodes: [],
                },
              ],
            },
            header,
            billingProviderAndPayer,
            matchedClaim: { id: claim.id, patient: claim.patient, type: claim.type },
          })
        ),
      },
      {
        method: 'POST',
        url: '/Provenance',
        resource: tagged(
          buildManualEraProvenance({
            targets: ['urn:uuid:era', 'urn:uuid:remit'],
            agent: { display: 'Integration Biller' },
            recorded: '2026-03-12T12:00:00.000Z',
          })
        ),
      },
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: tagged<PaymentNotice>({
          resourceType: 'PaymentNotice',
          status: 'active',
          request: { reference: `Claim/${claim.id}` },
          identifier: [{ system: WRITE_OFF_SYSTEM }],
          created: '2026-03-13T10:00:00.000Z',
          paymentDate: '2026-03-13',
          payment: { display: 'Write-off' },
          recipient: { reference: `Organization/${billingProvider.id}` },
          amount: { value: 15, currency: 'USD' },
          extension: [
            { url: WRITE_OFF_PARTY_EXT_URL, valueString: 'patient' },
            { url: WRITE_OFF_REASON_EXT_URL, valueString: 'Small balance' },
          ],
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
          created: '2026-03-01T15:00:00.000Z',
          paymentDate: '2026-03-01',
          payment: { display: 'Copay' },
          recipient: { reference: `Organization/${billingProvider.id}` },
          amount: { value: 20, currency: 'USD' },
        }),
      },
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: tagged<PaymentNotice>({
          resourceType: 'PaymentNotice',
          status: 'active',
          request: { reference: `Claim/${claim.id}` },
          identifier: [{ system: NIO_INVOICE_PAYMENT_ID_SYSTEM, value: randomUUID() }],
          created: '2026-03-14T10:00:00.000Z',
          paymentDate: '2026-03-14',
          payment: { display: 'Employer check' },
          recipient: { reference: `Organization/${billingProvider.id}` },
          amount: { value: 5, currency: 'USD' },
        }),
      },
    ];
    const [payments, submitted] = await Promise.all([
      billing.fhir.transaction<FhirResource>({ requests: paymentsRequests }),
      admin.fhir.create<ClaimResponse>(
        tagged<ClaimResponse>({
          resourceType: 'ClaimResponse',
          status: 'active',
          type: claim.type!,
          use: 'claim',
          patient: { reference: `Patient/${patient.id}` },
          created: '2026-03-02T09:30:00.000Z',
          insurer: { display: payer.name },
          outcome: 'queued',
          request: { reference: `Claim/${claim.id}` },
        })
      ),
    ]);
    const paymentResources = payments.entry!.map((entry) => entry.resource!);
    seeded = [...seeded, ...paymentResources, submitted];
    submission = submitted;
    [era] = ofType<PaymentReconciliation>(paymentResources, 'PaymentReconciliation');
    [remit] = ofType<ClaimResponse>(paymentResources, 'ClaimResponse');
    [writeOff, patientPayment, nioPayment] = ofType<PaymentNotice>(paymentResources, 'PaymentNotice');
  }, 90_000);

  afterAll(async () => {
    await admin.fhir
      .batch({
        requests: seeded
          .reverse()
          .map((resource) => ({ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` })),
      })
      .catch((error) => console.error('get-billing-claim-detail cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('combines the claim graph, other claims, remits, submissions, write-offs and payments', async () => {
    const detail = (await billing.zambda.execute({ id: 'get-billing-claim-detail', claimId: claim.id }))
      .output as ClaimDetailResponse;

    expect(detail).toMatchObject({
      id: claim.id,
      encounterId,
      dos: '2026-03-01',
      patientId: patient.id,
      patientName: `Detail${unique}, Dana`,
      patientDob: '1988-06-15',
      coverageFhirId: coverage.id,
      memberId: `DET-${unique}`,
      payorFhirId: payer.id,
      payerName: payer.name,
      payerId: `OTR-${unique}`,
      policyHolder: { firstName: 'Hal', lastName: `Holder${unique}`, dob: '1980-01-20', gender: 'male' },
      nonInsurancePayerFhirId: nonInsurancePayer.id,
      nonInsurancePayerName: nonInsurancePayer.name,
      renderingProviderId: renderingProvider.id,
      renderingProvider: `Renderer${unique}, Rita`,
      renderingNpi: '1245319599',
      billingProviderFhirId: billingProvider.id,
      billingProvider: billingProvider.name,
      billingNpi: '1234567893',
      billingTin: '123456789',
      facilityFhirId: facility.id,
      serviceFacility: facility.name,
      billed: 200,
      allowed: 180,
      insurancePaid: 120,
      patientResp: 60,
      patientPaid: 20,
      nioPaid: 5,
      writeOffsTotal: 15,
      balance: 20,
      adjudicated: true,
      firstSubmittedDate: submission.created,
      invoices: [],
    });
    expect(detail.otherClaims).toEqual([
      expect.objectContaining({ id: otherClaim.id, billed: 90, serviceDate: '2026-01-15', cptCodes: ['99212'] }),
    ]);
    expect(detail.remits).toEqual([
      expect.objectContaining({
        claimResponseId: remit.id,
        payerName: payer.name,
        paid: 120,
        allowed: 180,
        patientResp: 60,
        paymentReconciliationId: era.id,
        checkNumber: `DET-CHK-${unique}`,
        checkDate: '2026-03-11',
      }),
    ]);
    expect(detail.insurancePayments).toEqual([
      expect.objectContaining({
        paymentReconciliationId: era.id,
        checkNumber: `DET-CHK-${unique}`,
        paymentAmount: 120,
        payerName: payer.name,
      }),
    ]);
    expect(detail.writeOffs).toEqual([
      expect.objectContaining({ id: writeOff.id, amount: 15, party: 'patient', reason: 'Small balance' }),
    ]);
    expect(detail.patientPayments).toEqual([
      expect.objectContaining({ paymentNoticeId: patientPayment.id, amount: 20, paymentDate: '2026-03-01' }),
    ]);
    expect(detail.nioPayments).toEqual([
      expect.objectContaining({ paymentNoticeId: nioPayment.id, amount: 5, paymentDate: '2026-03-14' }),
    ]);
  }, 60_000);
});
