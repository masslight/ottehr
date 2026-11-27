import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import {
  getInvoiceTaskClaimId,
  getInvoiceTaskSource,
  parseInvoiceTaskInput,
} from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY,
  CreateInvoiceTasksForBillingClaimsResponse,
} from 'utils/lib/types/api/invoicing.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('create-invoice-tasks-for-billing-claims integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;

  const sendInvoiceCoding = RcmTaskCodings.sendInvoiceToPatient.coding![0];

  const findInvoiceTasks = async (): Promise<Task[]> =>
    (
      await oystehrAdmin.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'encounter', value: `Encounter/${base.encounter.id}` },
          { name: 'code', value: `${sendInvoiceCoding.system}|${sendInvoiceCoding.code}` },
        ],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'create-invoice-tasks-for-billing-claims.test.ts',
      M2MClientMockType.provider
    );
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (base) {
      const tasks = await findInvoiceTasks().catch(() => []);
      await Promise.all(
        tasks.map((task) =>
          oystehrAdmin.fhir.delete({ resourceType: 'Task', id: task.id! }).catch((error) => console.warn(error))
        )
      );
    }
    await cleanup();
  });

  it('creates a send-invoice task for the claim whose encounter exists and skips the unknown one', async () => {
    const claimId = randomUUID();
    const finalizationDate = DateTime.now().minus({ days: 1 }).toUTC().toISO()!;

    const { output } = await oystehrZambdas.zambda.execute({
      id: CREATE_INVOICE_TASKS_FOR_BILLING_CLAIMS_ZAMBDA_KEY,
      claims: [
        { claimId, encounterId: base.encounter.id, finalizationDate, balance: 12.34 },
        { claimId: randomUUID(), encounterId: randomUUID(), finalizationDate, balance: 5 },
      ],
    });

    expect(output as CreateInvoiceTasksForBillingClaimsResponse).toEqual({ created: 1, skipped: 1 });

    const tasks = await findInvoiceTasks();
    expect(tasks).toHaveLength(1);
    const [task] = tasks;
    expect(getInvoiceTaskClaimId(task)).toBe(claimId);
    expect(getInvoiceTaskSource(task)).toBe('ottehr-billing');
    expect(task.for?.reference).toBe(`Patient/${base.patient.id}`);
    expect(task.description).toBe('Send invoice for $12.34');

    const input = parseInvoiceTaskInput(task);
    expect(input).toMatchObject({ claimId, finalizationDate, amountCents: 1234 });
    expect(input.memo).toBeTruthy();
    expect(input.smsTextMessage).toBeTruthy();
    expect(DateTime.fromISO(input.dueDate!).isValid).toBe(true);
  });
});
