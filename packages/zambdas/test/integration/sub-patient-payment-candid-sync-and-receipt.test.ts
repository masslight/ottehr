import Oystehr from '@oystehr/sdk';
import { DocumentReference, FhirResource, List, PaymentNotice, Provenance, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { TaskIndicator } from 'utils/lib/types/common';
import { RECEIPT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { encounterIdForPaymentNotice, isBillingPaymentNotice } from '../../src/billing/patient-payments';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../../src/billing/payments';
import { index } from '../../src/subscriptions/task/sub-patient-payment-candid-sync-and-receipt/index';
import { SECRETS } from '../data/secrets';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const external = vi.hoisted(() => ({
  candidClient: { preEncounter: {} },
  performCandidPreEncounterSync: vi.fn(async () => undefined),
  stripe: {
    paymentIntents: { retrieve: vi.fn(), search: vi.fn() },
    paymentMethods: { retrieve: vi.fn() },
    customers: { retrieve: vi.fn() },
  },
}));

vi.mock('utils/lib/helpers/candidApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/helpers/candidApi')>()),
  getOrCreateCandidApiClient: vi.fn(async () => external.candidClient),
}));

vi.mock('../../src/shared/candid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/candid')>()),
  performCandidPreEncounterSync: external.performCandidPreEncounterSync,
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: vi.fn(() => external.stripe),
}));

const deleteTaggedResources = async (
  oystehr: Oystehr,
  processId: string,
  resourceTypes: FhirResource['resourceType'][]
): Promise<void> => {
  for (const resourceType of resourceTypes) {
    const resources = (
      await oystehr.fhir.search<FhirResource>({
        resourceType,
        params: [{ name: '_tag', value: `${INTEGRATION_TEST_PROCESS_ID_SYSTEM}|${processId}` }],
      })
    ).unbundle();
    await Promise.all(
      resources.map((resource) => oystehr.fhir.delete({ resourceType, id: resource.id! }).catch(() => undefined))
    );
  }
};

describe('sub-patient-payment-candid-sync-and-receipt', () => {
  let oystehr: Oystehr;
  let processId: string;
  let token: string;
  let providerProfile: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;
  let legacyNotice: PaymentNotice;
  let task: Task;

  const receiptBucket = `${SECRETS.PROJECT_ID}-receipts`;

  const findBillingCopies = async (): Promise<PaymentNotice[]> =>
    (
      await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [{ name: 'identifier', value: `${CLINICAL_PAYMENT_NOTICE_ID_SYSTEM}|${legacyNotice.id}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'sub-patient-payment-candid-sync-and-receipt.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    providerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;

    visit = await insertInPersonAppointmentBase(oystehr, processId);

    const created = DateTime.now().toUTC().toISO()!;
    legacyNotice = await oystehr.fhir.create<PaymentNotice>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'PaymentNotice',
          status: 'active',
          request: { reference: `Encounter/${visit.encounter.id}`, type: 'Encounter' },
          created,
          amount: { value: 25, currency: 'USD' },
          extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' }],
          contained: [
            {
              resourceType: 'PaymentReconciliation',
              id: 'contained-reconciliation',
              status: 'active',
              created,
              disposition: 'cash payment collected at the front desk',
              outcome: 'complete',
              paymentDate: DateTime.now().toISODate()!,
              paymentAmount: { value: 25, currency: 'USD' },
              detail: [
                {
                  type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payment-type', code: 'payment' }] },
                  submitter: { reference: providerProfile },
                },
              ],
            },
          ],
          payment: { reference: '#contained-reconciliation' },
          recipient: { reference: `Organization/${loadZambdaSecrets().ORGANIZATION_ID}` },
        },
        processId
      ) as PaymentNotice
    );

    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: {
            coding: [
              {
                system: TaskIndicator.patientPaymentCandidSyncAndReceipt.system,
                code: TaskIndicator.patientPaymentCandidSyncAndReceipt.code,
              },
            ],
          },
          focus: { type: 'PaymentNotice', reference: `PaymentNotice/${legacyNotice.id}` },
          encounter: { reference: `Encounter/${visit.encounter.id}` },
        },
        processId
      ) as Task
    );
  });

  afterAll(async () => {
    const billingCopies = await findBillingCopies().catch(() => [] as PaymentNotice[]);
    const provenances = (
      await Promise.all(
        billingCopies.map(async (notice) =>
          (
            await oystehr.fhir.search<Provenance>({
              resourceType: 'Provenance',
              params: [{ name: 'target', value: `PaymentNotice/${notice.id}` }],
            })
          ).unbundle()
        )
      )
    ).flat();
    const folders = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'subject', value: `Patient/${visit.patient.id}` }],
      })
    ).unbundle();
    await Promise.all(
      [...provenances, ...billingCopies, ...folders].map((resource) =>
        oystehr.fhir.delete({ resourceType: resource.resourceType, id: resource.id! }).catch(() => undefined)
      )
    );
    await oystehr.z3
      .deleteObject({ bucketName: receiptBucket, 'objectPath+': `${visit.patient.id}/${visit.encounter.id}.pdf` })
      .catch(() => undefined);
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['Task', 'PaymentNotice']);
  });

  it('records the cash payment in billing, syncs it to Candid and files a receipt', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{
      taskStatus: string;
      statusReason: { text?: string };
    }>(index, task, { token });

    expect(statusCode).toBe(200);
    expect(output.taskStatus).toBe('completed');
    expect(output.statusReason.text).toBe('Payment sync and receipt PDF completed successfully');

    const storedTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');

    const billingCopies = await findBillingCopies();
    expect(billingCopies).toHaveLength(1);
    const [billingCopy] = billingCopies;
    expect(isBillingPaymentNotice(billingCopy)).toBe(true);
    expect(billingCopy.meta?.tag).toContainEqual(expect.objectContaining(BILLING_RESOURCE_TAG));
    expect(encounterIdForPaymentNotice(billingCopy)).toBe(visit.encounter.id);
    expect(billingCopy.amount).toEqual({ value: 25, currency: 'USD' });
    expect(billingCopy.extension).toContainEqual({ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'cash' });

    expect(external.performCandidPreEncounterSync).toHaveBeenCalledTimes(1);
    expect(external.performCandidPreEncounterSync).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: visit.encounter.id,
        candidApiClient: external.candidClient,
        amountCents: 2500,
      })
    );
    expect(external.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();

    const receipts = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
          { name: 'type', value: `http://loinc.org|${RECEIPT_CODE}` },
          { name: 'status', value: 'current' },
        ],
      })
    ).unbundle();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].subject?.reference).toBe(`Patient/${visit.patient.id}`);
    expect(receipts[0].content[0].attachment.url).toBe(
      `${SECRETS.PROJECT_API}/z3/${receiptBucket}/${visit.patient.id}/${visit.encounter.id}.pdf`
    );
  });
});
