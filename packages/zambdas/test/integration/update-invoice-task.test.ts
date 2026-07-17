import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Task as FhirTask } from 'fhir/r4b';
import { createInvoiceTaskInput, M2MClientMockType, mapDisplayToInvoiceTaskStatus, RcmTaskCodings } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for update-invoice-task: update the status of an existing invoice
// Task. Seeds a sendInvoiceToPatient Task (status "ready") for the seed patient,
// then updates it (kept at "ready" so no send subscription fires). FHIR-only.
describe('update-invoice-task integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let taskId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-invoice-task.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const task = await oystehrAdmin.fhir.create<FhirTask>({
      resourceType: 'Task',
      status: mapDisplayToInvoiceTaskStatus('ready'),
      intent: 'order',
      code: RcmTaskCodings.sendInvoiceToPatient,
      for: { reference: `Patient/${base.patient.id}` },
      encounter: { reference: `Encounter/${base.encounter.id}` },
      authoredOn: new Date().toISOString(),
      input: createInvoiceTaskInput({
        amountCents: 1000,
        dueDate: '2030-12-31',
        memo: 'Integration test invoice',
        smsTextMessage: 'Test SMS',
        claimId: randomUUID(),
        finalizationDate: new Date().toISOString(),
      }),
    });
    taskId = task.id;
  }, 60_000);

  afterAll(async () => {
    if (taskId) {
      await oystehrAdmin.fhir.delete({ resourceType: 'Task', id: taskId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('updates an invoice task status', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'update-invoice-task',
      taskId,
      status: mapDisplayToInvoiceTaskStatus('ready'),
    });
    expect(response.output).toBeDefined();
  });
});
