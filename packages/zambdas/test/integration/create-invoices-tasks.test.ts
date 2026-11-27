import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { getInvoiceTaskSource, parseInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/cron/create-invoices-tasks/index';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const candid = vi.hoisted(() => ({
  inventory: [] as { claimId: string; encounterId: string; patientExternalId: string; timestamp: Date }[],
  itemize: vi.fn(async (claimId: string) => ({ ok: true, body: { claimId, patientBalanceCents: 3200 } })),
  getCandidInventoryPages: vi.fn(),
}));

vi.mock('utils/lib/helpers/candidApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/helpers/candidApi')>()),
  getOrCreateCandidApiClient: vi.fn(async () => ({ patientAr: { v1: { itemize: candid.itemize } } })),
  getCandidInventoryPages: candid.getCandidInventoryPages,
}));

describe('create-invoices-tasks', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;

  const candidEncounterId = randomUUID();
  const candidClaimId = randomUUID();
  const claimTimestamp = DateTime.now().minus({ hours: 3 }).toUTC();

  const invoiceTasksOfVisit = async (): Promise<Task[]> =>
    (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
          {
            name: 'code',
            value: `${RcmTaskCodings.sendInvoiceToPatient.coding?.[0].system}|${RcmTaskCodings.sendInvoiceToPatient.coding?.[0].code}`,
          },
        ],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-invoices-tasks.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    visit = await insertInPersonAppointmentBase(oystehr, setup.processId);
    await oystehr.fhir.patch<Encounter>({
      resourceType: 'Encounter',
      id: visit.encounter.id!,
      operations: [
        {
          op: 'add',
          path: '/identifier',
          value: [{ system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: candidEncounterId }],
        },
      ],
    });

    candid.getCandidInventoryPages.mockResolvedValue({
      claims: [
        {
          claimId: candidClaimId,
          encounterId: candidEncounterId,
          patientExternalId: visit.patient.id!,
          timestamp: claimTimestamp.toJSDate(),
        },
      ],
      pageCount: 1,
    });
  });

  afterAll(async () => {
    const tasks = await invoiceTasksOfVisit().catch(() => [] as Task[]);
    await Promise.all(
      tasks.map((task) => oystehr.fhir.delete({ resourceType: 'Task', id: task.id! }).catch(() => undefined))
    );
    await cleanup();
  });

  it('creates a ready invoice task for the encounter of an invoiceable Candid claim', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ message: string }>(index, {}, { token });

    expect(statusCode).toBe(200);
    expect(output).toEqual({ message: 'Successfully created tasks for encounters' });
    expect(candid.getCandidInventoryPages).toHaveBeenCalledWith(expect.objectContaining({ onlyInvoiceable: true }));
    expect(candid.itemize).toHaveBeenCalledWith(candidClaimId);

    const tasks = await invoiceTasksOfVisit();
    expect(tasks).toHaveLength(1);
    const [task] = tasks;
    expect(task.status).toBe('ready');
    expect(task.for?.reference).toBe(`Patient/${visit.patient.id}`);
    expect(getInvoiceTaskSource(task)).toBe('candid');

    const input = parseInvoiceTaskInput(task);
    expect(input.amountCents).toBe(3200);
    expect(input.claimId).toBe(candidClaimId);
    expect(input.finalizationDate).toBe(claimTimestamp.toJSDate().toISOString());
    expect(DateTime.fromISO(input.dueDate!) >= DateTime.now().startOf('day')).toBe(true);
  });
});
