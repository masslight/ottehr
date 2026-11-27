import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, FhirResource, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { TaskIndicator } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import { FullAppointmentResourcePackage } from '../../src/shared/pdf/visit-details-pdf/types';
import { index } from '../../src/subscriptions/task/sub-send-claim/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const candid = vi.hoisted(() => ({
  client: { encounters: {} },
  createEncounterFromAppointment: vi.fn(),
}));

vi.mock('utils/lib/helpers/candidApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/helpers/candidApi')>()),
  getOrCreateCandidApiClient: vi.fn(async () => candid.client),
}));

vi.mock('../../src/shared/candid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/candid')>()),
  createEncounterFromAppointment: candid.createEncounterFromAppointment,
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

describe('sub-send-claim', () => {
  let oystehr: Oystehr;
  let processId: string;
  let token: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;
  let task: Task;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-send-claim.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;

    visit = await insertInPersonAppointmentBase(oystehr, processId);

    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: { coding: [{ system: TaskIndicator.sendClaim.system, code: TaskIndicator.sendClaim.code }] },
          focus: { type: 'Appointment', reference: `Appointment/${visit.appointment.id}` },
          encounter: { reference: `Encounter/${visit.encounter.id}` },
        },
        processId
      ) as Task
    );
  });

  afterAll(async () => {
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['Task']);
  });

  it('submits the visit to Candid, stores the Candid encounter id and completes the task', async () => {
    const candidEncounterId = randomUUID();
    candid.createEncounterFromAppointment.mockResolvedValueOnce(candidEncounterId);

    const { statusCode, output } = await invokeZambdaHandler<{
      taskStatus: string;
      statusReason: { text?: string };
    }>(index, task, { token });

    expect(statusCode).toBe(200);
    expect(output.taskStatus).toBe('completed');
    expect(output.statusReason.text).toBe('claim sent successfully');

    expect(candid.createEncounterFromAppointment).toHaveBeenCalledTimes(1);
    const [visitResources, , candidClient] = candid.createEncounterFromAppointment.mock.calls[0] as [
      FullAppointmentResourcePackage,
      Oystehr,
      unknown,
    ];
    expect(candidClient).toBe(candid.client);
    expect(visitResources.appointment.id).toBe(visit.appointment.id);
    expect(visitResources.encounter.id).toBe(visit.encounter.id);
    expect(visitResources.patient?.id).toBe(visit.patient.id);

    const [storedTask, encounter] = await Promise.all([
      oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! }),
      oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: visit.encounter.id! }),
    ]);
    expect(storedTask.status).toBe('completed');
    expect(encounter.identifier).toContainEqual({
      system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
      value: candidEncounterId,
    });
  });
});
