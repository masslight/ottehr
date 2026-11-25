import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Organization, PaymentNotice, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getContainedReconciliation, getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { RecordBillingManualPaymentResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { toClaimPatientPayment } from '../../../src/billing/claim-amounts';
import { ensurePaymentTaskForNotice } from '../../../src/billing/patient-payments';
import { CHECK_NUMBER_IDENTIFIER_SYSTEM, MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../../src/billing/payments';
import { index } from '../../../src/billing/record-billing-manual-payment/index';
import {
  addProcessIdMetaTagToResource,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../../helpers/invoke-zambda-handler';

vi.mock('../../../src/billing/patient-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/billing/patient-payments')>();
  return { ...actual, ensurePaymentTaskForNotice: vi.fn() };
});

describe('record-billing-manual-payment', () => {
  let oystehr: Oystehr;
  let token: string;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const createdDeletes: BatchInputDeleteRequest[] = [];
  let encounterId: string;
  let locationId: string | undefined;
  let providerId: string;
  let claimId: string;

  const seed = async <T extends FhirResource>(client: Oystehr, resource: T): Promise<string> => {
    const created = await client.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/record-billing-manual-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    processId = setup.processId;

    const visit = await insertInPersonAppointmentBase(oystehr, processId);
    encounterId = visit.encounter.id!;
    locationId = visit.appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.split('/')[1];
    if (locationId) seededDeletes.push({ method: 'DELETE', url: `Location/${locationId}` });
    providerId = await seed<Organization>(setup.oystehrBilling, {
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
    });
    claimId = await seed<Claim>(setup.oystehrBilling, {
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-04-01',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { display: 'Jon Snow' },
      provider: { reference: `Organization/${providerId}` },
      identifier: [{ system: ottehrIdentifierSystem('claim-encounter-id'), value: encounterId }],
      total: { value: 150, currency: 'USD' },
      meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'ready-to-invoice' }) },
    });
  }, 120_000);

  afterAll(async () => {
    try {
      if (createdDeletes.length > 0) await oystehr.fhir.batch({ requests: createdDeletes });
      await oystehr.fhir.batch({
        requests: seededDeletes,
      });
    } catch (error) {
      console.error('Failed to clean up fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it("records the check on the encounter's claim, credits the caller and schedules the payment task", async () => {
    const input = {
      encounterId,
      amountInCents: 6000,
      paymentMethod: 'check',
      paymentDateISO: '2026-04-10T15:00:00.000Z',
      checkNumber: '10442',
      description: 'Mailed check',
      idempotencyKey: randomUUID(),
    };
    const record = async (): Promise<RecordBillingManualPaymentResponse> => {
      const { statusCode, output } = await invokeZambdaHandler<RecordBillingManualPaymentResponse>(index, input, {
        token,
      });
      expect(statusCode).toBe(200);
      return output;
    };

    const response = await record();
    const [notice, history, practitioner] = await Promise.all([
      oystehr.fhir.get<PaymentNotice>({ resourceType: 'PaymentNotice', id: response.paymentNoticeId }),
      oystehr.fhir
        .search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `PaymentNotice/${response.paymentNoticeId}` }],
        })
        .then((bundle) => bundle.unbundle()),
      oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: callerProfile.split('/')[1] }),
    ]);
    createdDeletes.push(
      ...history.map(
        (resource): BatchInputDeleteRequest => ({ method: 'DELETE', url: `${resource.resourceType}/${resource.id}` })
      ),
      { method: 'DELETE', url: `PaymentNotice/${response.paymentNoticeId}` }
    );

    expect(response.claimId).toBe(claimId);
    expect(toClaimPatientPayment(notice)).toMatchObject({
      amount: 60,
      method: 'check',
      paymentDate: '2026-04-10',
      description: 'Mailed check',
      checkNumber: '10442',
      status: 'active',
    });
    expect(notice.request?.reference).toBe(`Claim/${claimId}`);
    expect(notice.payee?.reference).toBe(`Organization/${providerId}`);
    expect(notice.identifier).toContainEqual({
      system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
      value: input.idempotencyKey,
    });
    expect(getContainedReconciliation(notice)?.paymentIdentifier).toEqual({
      system: CHECK_NUMBER_IDENTIFIER_SYSTEM,
      value: '10442',
    });
    expect(getPaymentNoticeSubmitterRef(notice)).toEqual({
      reference: callerProfile,
      display: `${practitioner.name?.[0]?.given?.[0]} ${practitioner.name?.[0]?.family}`,
    });

    expect(ensurePaymentTaskForNotice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: response.paymentNoticeId }),
      encounterId
    );
    expect(history.map((entry) => entry.agent[0].who?.reference)).toEqual([callerProfile]);

    expect((await record()).paymentNoticeId).toBe(response.paymentNoticeId);
  }, 120_000);
});
