import Oystehr from '@oystehr/sdk';
import { Appointment, Consent, Encounter, FhirResource, Patient, QuestionnaireResponse, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { TASK_INPUT_TYPE_CODES, TASK_INPUT_TYPE_SYSTEM, TaskIndicator } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { index } from '../../src/subscriptions/task/sub-merge-patients/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

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

describe('sub-merge-patients', () => {
  let oystehr: Oystehr;
  let processId: string;
  let token: string;
  let providerProfile: string;
  let cleanup: () => Promise<void>;
  let main: InsertFullAppointmentDataBaseResult;
  let other: InsertFullAppointmentDataBaseResult;
  let task: Task;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-merge-patients.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    processId = setup.processId;
    token = setup.testUserM2MToken;
    providerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;

    [main, other] = await Promise.all([
      insertInPersonAppointmentBase(oystehr, processId),
      insertInPersonAppointmentBase(oystehr, processId),
    ]);

    const mergeQr = await oystehr.fhir.create<QuestionnaireResponse>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          subject: { reference: `Patient/${main.patient.id}` },
        },
        processId
      ) as QuestionnaireResponse
    );

    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: { coding: [{ system: TaskIndicator.mergePatients.system, code: TaskIndicator.mergePatients.code }] },
          focus: { reference: `QuestionnaireResponse/${mergeQr.id}` },
          for: { reference: `Patient/${main.patient.id}` },
          input: [
            {
              type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.OTHER_PATIENT_ID }] },
              valueString: other.patient.id,
            },
            {
              type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PROVIDER_PROFILE }] },
              valueString: providerProfile,
            },
          ],
        },
        processId
      ) as Task
    );
  });

  afterAll(async () => {
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['Task', 'QuestionnaireResponse', 'Patient']);
  });

  it('merges the other patient into the main patient and completes the task', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ taskStatus: string; statusReason: string }>(
      index,
      task,
      { token }
    );

    expect(statusCode).toBe(200);
    const expectedReason = `merged Patient/${other.patient.id} into Patient/${main.patient.id}`;
    expect(output).toEqual({ taskStatus: 'completed', statusReason: expectedReason });

    const [storedTask, otherPatient, otherAppointment, otherEncounter, consents] = await Promise.all([
      oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! }),
      oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: other.patient.id! }),
      oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: other.appointment.id! }),
      oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: other.encounter.id! }),
      oystehr.fhir
        .search<Consent>({
          resourceType: 'Consent',
          params: [{ name: 'patient', value: `Patient/${main.patient.id}` }],
        })
        .then((bundle) => bundle.unbundle()),
    ]);

    expect(storedTask.status).toBe('completed');
    expect(storedTask.statusReason?.text).toBe(expectedReason);
    expect(otherPatient.active).toBe(false);
    expect(otherPatient.link).toContainEqual({
      other: { reference: `Patient/${main.patient.id}` },
      type: 'replaced-by',
    });
    expect(otherAppointment.participant.map((p) => p.actor?.reference)).toContain(`Patient/${main.patient.id}`);
    expect(otherAppointment.participant.map((p) => p.actor?.reference)).not.toContain(`Patient/${other.patient.id}`);
    expect(otherEncounter.subject?.reference).toBe(`Patient/${main.patient.id}`);
    expect(consents).toHaveLength(2);
  });
});
