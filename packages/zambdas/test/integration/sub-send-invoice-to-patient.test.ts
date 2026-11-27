import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Encounter, FhirResource, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, RcmTaskCode, RcmTaskCodings } from 'utils/lib/fhir/constants';
import { createInvoiceTaskInput, mapDisplayToInvoiceTaskStatus } from 'utils/lib/helpers/tasks/invoices-tasks';
import { TaskIndicator } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import { STRIPE_METADATA_KEYS } from '../../src/shared/stripeIntegration';
import { index } from '../../src/subscriptions/task/sub-send-invoice-to-patient/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const external = vi.hoisted(() => ({
  stripe: {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    invoices: {
      create: vi.fn(),
      finalizeInvoice: vi.fn(),
      sendInvoice: vi.fn(),
      search: vi.fn(async () => ({ data: [] })),
    },
    invoiceItems: { create: vi.fn() },
  },
  sendSmsForPatient: vi.fn(async () => ({ total: 1, sent: 1, failures: [] })),
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: vi.fn(() => external.stripe),
}));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  sendSmsForPatient: external.sendSmsForPatient,
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

describe('sub-send-invoice-to-patient', () => {
  let oystehr: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;
  let task: Task;

  const stripeCustomerId = `cus_${randomUUID()}`;
  const stripeInvoiceId = `in_${randomUUID()}`;
  const hostedInvoiceUrl = `https://invoice.stripe.test/${stripeInvoiceId}`;

  const tasksOfVisit = async (): Promise<Task[]> => {
    const [byEncounter, byPatient] = await Promise.all(
      [
        { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
        { name: 'patient', value: `Patient/${visit.patient.id}` },
      ].map(async (param) => (await oystehr.fhir.search<Task>({ resourceType: 'Task', params: [param] })).unbundle())
    );
    return [...new Map([...byEncounter, ...byPatient].map((t) => [t.id, t])).values()];
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-send-invoice-to-patient.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    visit = await insertInPersonAppointmentBase(oystehr, processId);

    const [account] = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${visit.patient.id}` }],
      })
    ).unbundle();
    await Promise.all([
      oystehr.fhir.patch<Account>({
        resourceType: 'Account',
        id: account.id!,
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [{ system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, value: stripeCustomerId }],
          },
        ],
      }),
      oystehr.fhir.patch<Encounter>({
        resourceType: 'Encounter',
        id: visit.encounter.id!,
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [{ system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: randomUUID() }],
          },
        ],
      }),
    ]);

    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: mapDisplayToInvoiceTaskStatus('ready'),
          intent: 'order',
          code: RcmTaskCodings.sendInvoiceToPatient,
          for: { reference: `Patient/${visit.patient.id}` },
          encounter: { reference: `Encounter/${visit.encounter.id}` },
          authoredOn: DateTime.now().toISO()!,
          input: createInvoiceTaskInput({
            amountCents: 4500,
            dueDate: DateTime.now().plus({ days: 30 }).toISODate()!,
            memo: 'Visit for {{patient-full-name}} at {{location}}',
            smsTextMessage: 'Please pay {{amount}} at {{invoice-link}}',
            claimId: randomUUID(),
            finalizationDate: DateTime.now().toISO()!,
          }),
        },
        processId
      ) as Task
    );

    external.stripe.customers.retrieve.mockResolvedValue({ id: stripeCustomerId, email: 'jon.snow@example.com' });
    external.stripe.invoices.create.mockResolvedValue({ id: stripeInvoiceId, status: 'draft' });
    external.stripe.invoiceItems.create.mockResolvedValue({ id: `ii_${randomUUID()}` });
    external.stripe.invoices.finalizeInvoice.mockResolvedValue({
      id: stripeInvoiceId,
      status: 'open',
      customer_email: 'jon.snow@example.com',
    });
    external.stripe.invoices.sendInvoice.mockResolvedValue({
      id: stripeInvoiceId,
      status: 'open',
      hosted_invoice_url: hostedInvoiceUrl,
    });
  });

  afterAll(async () => {
    const tasks = await tasksOfVisit().catch(() => [] as Task[]);
    await Promise.all(
      tasks.map((t) => oystehr.fhir.delete({ resourceType: 'Task', id: t.id! }).catch(() => undefined))
    );
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['Task']);
  });

  it('creates, finalizes and sends the Stripe invoice, texts the patient and completes the task', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ message: string }>(index, task, { token });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ message: 'Invoice created and sent successfully' });

    expect(external.stripe.invoices.create).toHaveBeenCalledTimes(1);
    const [invoiceParams, invoiceOptions] = external.stripe.invoices.create.mock.calls[0] as unknown as [
      Record<string, any>,
      Record<string, unknown>,
    ];
    expect(invoiceOptions).toEqual({ stripeAccount: undefined });
    expect(invoiceParams.customer).toBe(stripeCustomerId);
    expect(invoiceParams.collection_method).toBe('send_invoice');
    expect(invoiceParams.metadata).toMatchObject({
      [STRIPE_METADATA_KEYS.encounterId]: visit.encounter.id,
      [STRIPE_METADATA_KEYS.patientId]: visit.patient.id,
    });
    expect(invoiceParams.description).toBe('Visit for Jon Snow at Integration Test Location');
    expect(external.stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: stripeCustomerId, amount: 4500, invoice: stripeInvoiceId }),
      { stripeAccount: undefined }
    );
    expect(external.stripe.invoices.finalizeInvoice).toHaveBeenCalledWith(stripeInvoiceId, {
      stripeAccount: undefined,
    });
    expect(external.stripe.invoices.sendInvoice).toHaveBeenCalledWith(stripeInvoiceId, { stripeAccount: undefined });

    expect(external.sendSmsForPatient).toHaveBeenCalledTimes(1);
    const [smsMessage, , smsPatient] = external.sendSmsForPatient.mock.calls[0] as unknown as [
      string,
      Oystehr,
      Patient,
    ];
    expect(smsMessage).toBe(`Please pay $45.00 at ${hostedInvoiceUrl}`);
    expect(smsPatient.id).toBe(visit.patient.id);

    const storedTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');
    const outputValue = (code: string): string | undefined =>
      storedTask.output?.find((entry) => entry.type.coding?.some((coding) => coding.code === code))?.valueString;
    expect(outputValue(RcmTaskCode.sendInvoiceOutputInvoiceId)).toBe(stripeInvoiceId);
    expect(outputValue(RcmTaskCode.stripeInvoiceStatus)).toBe('open');

    const statementTasks = (await tasksOfVisit()).filter(
      (t) => t.code?.coding?.some((coding) => coding.code === TaskIndicator.generatePatientStatement.code)
    );
    expect(statementTasks).toHaveLength(1);
    expect(statementTasks[0].for?.reference).toBe(`Patient/${visit.patient.id}`);
    expect(statementTasks[0].focus?.reference).toBe(`Appointment/${visit.appointment.id}`);
  });
});
