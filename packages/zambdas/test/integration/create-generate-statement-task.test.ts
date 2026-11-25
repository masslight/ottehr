import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { TaskIndicator } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BILLING_APP_INVOICE_STATEMENT_INPUT } from '../../src/shared/statements/get-statement-details';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('create-generate-statement-task integration', () => {
  let oystehr: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('create-generate-statement-task.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTaskIds) {
      await oystehr.fhir.delete({ resourceType: 'Task', id }).catch(() => undefined);
    }
    await cleanup();
  });

  it('creates a generate-statement Task for the visit, named after the patient and the visit date', async () => {
    const { output } = await oystehrProvider.zambda.execute({
      id: 'create-generate-statement-task',
      encounterId: base.encounter.id,
      billingAppInvoice: true,
    });
    const { taskId, taskReference } = output as { taskId: string; taskReference: string };
    createdTaskIds.push(taskId);
    expect(taskReference).toBe(`Task/${taskId}`);

    const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId });
    const visitDate = DateTime.fromISO(base.appointment.start!, { setZone: true }).toFormat('yyyy-MM-dd');
    expect(task.code?.coding).toEqual([TaskIndicator.generatePatientStatement]);
    expect(task.description).toBe(
      `Generate statement for ${getFullestAvailableName(base.patient)} visit on ${visitDate}`
    );
    expect(task.focus?.reference).toBe(`Appointment/${base.appointment.id}`);
    expect(task.encounter?.reference).toBe(`Encounter/${base.encounter.id}`);
    expect(task.for?.reference).toBe(`Patient/${base.patient.id}`);
    expect(task.input).toEqual([BILLING_APP_INVOICE_STATEMENT_INPUT]);
  }, 60_000);
});
