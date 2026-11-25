import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, ClaimResponse, FhirResource, Patient, PaymentNotice } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  BillingInvoiceTaskClaim,
  CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY,
} from 'utils/lib/types/api/invoicing.types';
import {
  AR_STAGE,
  CLAIM_STATUS_DATE_EXTENSION_URLS,
  claimStatusValuesToTags,
} from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OYSTEHR_ADJUDICATION_SYSTEM, X12_ADJUSTMENT_GROUP_SYSTEM } from '../../../src/billing/claim-amounts';
import {
  buildPaymentNotice,
  claimRequestFor,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
} from '../../../src/billing/payments';
import { index } from '../../../src/cron/create-billing-invoices-tasks/index';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

const { executeClinicalZambda } = vi.hoisted(() => ({
  executeClinicalZambda: vi.fn(),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/billing/shared')>();
  return {
    ...actual,
    createBillingClient: (...args: Parameters<typeof actual.createBillingClient>) => {
      const client = actual.createBillingClient(...args);
      client.zambda.execute = executeClinicalZambda;
      return client;
    },
  };
});

describe('create-billing-invoices-tasks', () => {
  let oystehrBilling: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const owingEncounterId = randomUUID();
  const paidEncounterId = randomUUID();
  const enteredPatientArDate = '2026-08-05T14:00:00.000Z';
  let owingClaimId: string;
  let paidClaimId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T;
  };

  const seedPatientArClaim = async (patientId: string, encounterId: string, billed: number): Promise<Claim> =>
    seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-08-03',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${patientId}` },
      provider: { display: 'Integration Medical Group' },
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: billed, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate: '2026-08-03' }],
      extension: [{ url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr, valueDateTime: enteredPatientArDate }],
      meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }) },
    });

  const seedPatientPayment = async (claim: Claim, encounterId: string, amountInCents: number): Promise<void> => {
    await seed<PaymentNotice>(
      buildPaymentNotice({
        request: claimRequestFor(claim, encounterId),
        payee: { display: 'Integration Medical Group' },
        amountInCents,
        paymentMethod: 'cash',
        identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
        paymentDate: '2026-08-10',
        createdISO: '2026-08-10T15:00:00.000Z',
        disposition: 'cash payment collected manually',
      })
    );
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/create-billing-invoices-tasks.test.ts',
      M2MClientMockType.provider
    );
    oystehrBilling = setup.oystehrBilling;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    const patient = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [{ family: `Invoice${randomUUID().slice(0, 8)}`, given: ['Riley'] }],
      birthDate: '1990-02-02',
    });

    const [owingClaim, paidClaim] = await Promise.all([
      seedPatientArClaim(patient.id!, owingEncounterId, 200),
      seedPatientArClaim(patient.id!, paidEncounterId, 50),
    ]);
    owingClaimId = owingClaim.id!;
    paidClaimId = paidClaim.id!;

    await Promise.all([
      seed<ClaimResponse>({
        resourceType: 'ClaimResponse',
        status: 'active',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        use: 'claim',
        patient: { reference: `Patient/${patient.id}` },
        created: '2026-08-04T12:00:00Z',
        insurer: { display: 'Integration Payer' },
        request: { reference: `Claim/${owingClaimId}` },
        outcome: 'complete',
        item: [
          {
            itemSequence: 1,
            adjudication: [
              {
                category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: 'allowed' }] },
                amount: { value: 150 },
              },
              { category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: 'paid' }] }, amount: { value: 100 } },
              {
                category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: 'PR' }] },
                reason: { coding: [{ code: '1' }] },
                amount: { value: 50 },
              },
            ],
          },
        ],
      }),
      seedPatientPayment(owingClaim, owingEncounterId, 2000),
      seedPatientPayment(paidClaim, paidEncounterId, 5000),
    ]);

    executeClinicalZambda.mockResolvedValue({ output: { created: 1, skipped: 0 } });
  }, 120_000);

  afterAll(async () => {
    if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    await cleanup();
  }, 120_000);

  it('hands the active patient AR claims with a balance to the clinical invoice task endpoint', async () => {
    const { statusCode, output } = await invokeZambdaHandler(index, {}, { token });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ message: 'Successfully created tasks for billing claims', created: 1, skipped: 0 });

    expect(executeClinicalZambda).toHaveBeenCalledTimes(1);
    const [request] = executeClinicalZambda.mock.calls[0] as [{ id: string; claims: BillingInvoiceTaskClaim[] }];
    expect(request.id).toBe(CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY);
    expect(request.claims).toContainEqual({
      claimId: owingClaimId,
      encounterId: owingEncounterId,
      finalizationDate: enteredPatientArDate,
      balance: 30,
    });
    expect(request.claims.map((claim) => claim.claimId)).not.toContain(paidClaimId);
  });
});
