import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, FhirResource, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { NIO_INVOICE_PAYMENT_ID_SYSTEM } from 'utils/lib/fhir/billing-invoice';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { SearchBillingPatientARClaimsResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  ManualEraBillingProviderAndPayer,
} from '../../../src/billing/manual-era';
import { MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { WRITE_OFF_PARTY_EXT_URL, WRITE_OFF_REASON_EXT_URL, WRITE_OFF_SYSTEM } from '../../../src/billing/write-offs';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('search-billing-patient-ar-claims', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  const encounterId = randomUUID();
  let seeded: FhirResource[] = [];
  let patient: Patient;
  let claim: Claim;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const notice = (fields: Pick<PaymentNotice, 'request' | 'identifier' | 'amount' | 'extension'>): PaymentNotice =>
    tagged<PaymentNotice>({
      resourceType: 'PaymentNotice',
      status: 'active',
      created: '2026-03-15T10:00:00.000Z',
      paymentDate: '2026-03-15',
      payment: { display: 'Payment' },
      recipient: { display: 'Patient AR Billing Group' },
      ...fields,
    });

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/search-billing-patient-ar-claims.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const graph = (
      await billing.fhir.transaction<FhirResource>({
        requests: [
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({ resourceType: 'Organization', name: `Patient AR Payer ${unique}` }),
          },
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({ resourceType: 'Organization', name: `Patient AR Group ${unique}` }),
          },
          {
            method: 'POST',
            url: '/Patient',
            fullUrl: 'urn:uuid:patient',
            resource: tagged<Patient>({
              resourceType: 'Patient',
              name: [{ family: `Owes${unique}`, given: ['Olive'] }],
              birthDate: '1970-09-09',
            }),
          },
          {
            method: 'POST',
            url: '/Claim',
            resource: tagged<Claim>({
              resourceType: 'Claim',
              meta: {
                tag: [
                  { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient },
                  { system: CLAIM_STATUS_TAG_SYSTEMS.patientArStatus, code: 'ready-to-invoice' },
                ],
              },
              // not active, so the ERA-match subscription (request.status=active) leaves the claim alone
              status: 'draft',
              use: 'claim',
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
              identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
              patient: { reference: 'urn:uuid:patient' },
              created: '2026-03-01',
              provider: { display: 'Unknown' },
              priority: {
                coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
              },
              insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
              item: [
                {
                  sequence: 1,
                  productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99214' }] },
                  servicedPeriod: { start: '2026-03-01' },
                  net: { value: 200, currency: 'USD' },
                },
              ],
              total: { value: 200, currency: 'USD' },
            }),
          },
        ],
      })
    ).entry!.map((entry) => entry.resource!);
    seeded.push(...graph);
    const [payer, billingProvider] = graph.filter(
      (resource): resource is Organization => resource.resourceType === 'Organization'
    );
    patient = graph.find((resource): resource is Patient => resource.resourceType === 'Patient')!;
    claim = graph.find((resource): resource is Claim => resource.resourceType === 'Claim')!;

    const header: ManualEraHeader = {
      payerId: payer.id!,
      billingProviderRef: `Organization/${billingProvider.id}`,
      checkNumber: `PAR-${unique}`,
      checkAmountCents: 12000,
      remitDate: '2026-03-10',
      checkDate: '2026-03-09',
    };
    const billingProviderAndPayer: ManualEraBillingProviderAndPayer = {
      payer: { reference: `Organization/${payer.id}`, display: payer.name! },
      billingProvider: { reference: `Organization/${billingProvider.id}`, name: billingProvider.name! },
    };
    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/PaymentReconciliation',
        fullUrl: 'urn:uuid:era',
        resource: tagged(
          buildManualPaymentReconciliation({
            header,
            billingProviderAndPayer,
            created: '2026-03-10T12:00:00.000Z',
            editedAt: '2026-03-10T12:00:00.000Z',
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
              patientName: `Olive Owes${unique}`,
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
            recorded: '2026-03-10T12:00:00.000Z',
          })
        ),
      },
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: notice({
          request: { identifier: { system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId } },
          identifier: [{ system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() }],
          amount: { value: 20, currency: 'USD' },
        }),
      },
      {
        method: 'POST',
        url: '/PaymentNotice',
        resource: notice({
          request: { reference: `Claim/${claim.id}` },
          identifier: [{ system: WRITE_OFF_SYSTEM }],
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
        resource: notice({
          request: { reference: `Claim/${claim.id}` },
          identifier: [{ system: NIO_INVOICE_PAYMENT_ID_SYSTEM, value: randomUUID() }],
          amount: { value: 5, currency: 'USD' },
        }),
      },
    ];
    seeded = [
      ...seeded,
      ...(await billing.fhir.transaction<FhirResource>({ requests })).entry!.map((entry) => entry.resource!),
    ];
  }, 90_000);

  afterAll(async () => {
    await admin.fhir
      .batch({
        requests: seeded
          .reverse()
          .map((resource) => ({ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` })),
      })
      .catch((error) => console.error('search-billing-patient-ar-claims cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it("lists the patient's open patient AR claim with the balance left after remits, payments and write-offs", async () => {
    const response = (await billing.zambda.execute({ id: 'search-billing-patient-ar-claims', patientId: patient.id }))
      .output as SearchBillingPatientARClaimsResponse;

    expect(response.total).toBe(1);
    expect(response.claims).toEqual([
      expect.objectContaining({
        claimId: claim.id,
        patientId: patient.id,
        patientName: `Owes${unique}, Olive`,
        patientDob: '1970-09-09',
        encounterId,
        serviceDate: '2026-03-01',
        billed: 200,
        allowed: 180,
        insurancePaid: 120,
        patientResp: 60,
        patientPaid: 20,
        balance: 20,
        adjudicated: true,
      }),
    ]);
  }, 60_000);
});
