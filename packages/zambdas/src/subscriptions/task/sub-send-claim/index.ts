import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Task } from 'fhir/r4b';
import { getSecret, Secrets, SecretsKeys } from 'utils';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  createEncounterFromAppointment,
  createOystehrClient,
  getAuth0Token,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { validateRequestParameters } from '../validateRequestParameters';

export interface TaskSubscriptionInput {
  task: Task;
  secrets: Secrets;
}

type TaskStatus =
  | 'draft'
  | 'requested'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'ready'
  | 'cancelled'
  | 'in-progress'
  | 'on-hold'
  | 'failed'
  | 'completed'
  | 'entered-in-error';

let oystehrToken: string;
let oystehr: Oystehr;
let taskId: string | undefined;

const ZAMBDA_NAME = 'sub-send-claim';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { task, secrets } = validatedParameters;
    console.log('task ID', task.id);
    if (!task.id) {
      throw new Error('Task ID is required');
    }
    taskId = task.id;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    oystehr = createOystehrClient(oystehrToken, secrets);

    console.log('getting appointment Id from the task');
    const appointmentId =
      task.focus?.type === 'Appointment' ? task.focus?.reference?.replace('Appointment/', '') : undefined;
    console.log('appointment ID parsed: ', appointmentId);

    if (!appointmentId) {
      console.log('no appointment ID found on task');
      throw new Error('no appointment ID found on task focus');
    }

    const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
    if (!visitResources) {
      {
        throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
      }
    }

    const { encounter } = visitResources;

    // Check if candid encounter ID already exists in encounter identifier
    const existingCandidEncounterId = encounter.identifier?.find(
      (identifier) => identifier.system === CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM
    )?.value;

    if (existingCandidEncounterId) {
      console.log(
        `[CLAIM SUBMISSION] Candid encounter already exists with ID ${existingCandidEncounterId}, skipping creation`
      );
    } else {
      console.log('[CLAIM SUBMISSION] Attempting to create encounter in candid...');
      const candidEncounterId = await createEncounterFromAppointment(visitResources, secrets, oystehr);
      console.log(`[CLAIM SUBMISSION] Candid encounter created with ID ${candidEncounterId}`);

      // Put candid encounter id on the encounter
      const encounterPatchOps: Operation[] = [];

      if (candidEncounterId != null) {
        const identifier = {
          system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
          value: candidEncounterId,
        };
        encounterPatchOps.push({
          op: 'add',
          path: encounter.identifier != null ? '/identifier/-' : '/identifier',
          value: encounter.identifier != null ? identifier : [identifier],
        });
      }

      if (!encounter.id) {
        throw new Error('Encounter unexpectedly had no id');
      }

      await oystehr.fhir.patch({
        resourceType: 'Encounter',
        id: encounter.id,
        operations: encounterPatchOps,
      });
    }

    // update task status and status reason
    console.log('making patch request to update task status');
    const patchedTask = await patchTaskStatus(oystehr, task.id, 'completed', 'claim sent successfully');

    const response = {
      taskStatus: patchedTask.status,
      statusReason: patchedTask.statusReason,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    try {
      if (oystehr && taskId) await patchTaskStatus(oystehr, taskId, 'failed', JSON.stringify(error));
    } catch (patchError) {
      console.error('Error patching task status in top level catch:', patchError);
    }
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const patchTaskStatus = async (
  oystehr: Oystehr,
  taskId: string,
  status: TaskStatus,
  reason?: string
): Promise<Task> => {
  const patchedTask = await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: status,
      },
      {
        op: 'add',
        path: '/statusReason',
        value: {
          coding: [
            {
              system: 'status-reason',
              code: reason || 'no reason given',
            },
          ],
        },
      },
    ],
  });
  console.log('successfully patched task');
  console.log(JSON.stringify(patchedTask));
  return patchedTask;
};
