import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { getOrCreateCandidApiClient, MISSING_REQUEST_SECRETS } from 'utils';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  createEncounterFromAppointment,
  createOystehrClient,
  getAuth0Token,
  shouldSendClaim,
  shouldUseCandid,
  shouldUseOttehrBilling,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { patchTaskStatus } from '../../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

let oystehrToken: string;
let oystehr: Oystehr;
let taskId: string | undefined;

const ZAMBDA_NAME = 'sub-send-claim';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
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

      if (shouldSendClaim(secrets, encounter)) {
        if (shouldUseCandid(secrets)) {
          let candidApiClient: Awaited<ReturnType<typeof getOrCreateCandidApiClient>> | undefined;
          try {
            candidApiClient = await getOrCreateCandidApiClient(oystehr, secrets);
          } catch (error) {
            if (error !== MISSING_REQUEST_SECRETS) throw error;
            console.log('Candid not configured, skipping encounter submission to candid.');
          }
          if (candidApiClient) {
            console.log('[CLAIM SUBMISSION] Attempting to create encounter in candid...');
            const candidEncounterId = await createEncounterFromAppointment(visitResources, oystehr, candidApiClient);
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
        }
        // no else, these are not mutually exclusive
        if (shouldUseOttehrBilling(secrets)) {
          // currently a no op
        }
      }

      // update task status and status reason
      console.log('making patch request to update task status');
      const patchedTask = await patchTaskStatus(
        {
          task: {
            id: task.id,
          },
          taskStatusToUpdate: 'completed',
          statusReasonToUpdate: 'claim sent successfully',
        },
        oystehr
      );

      const response = {
        taskStatus: patchedTask.status,
        statusReason: patchedTask.statusReason,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: unknown) {
      try {
        if (oystehr && taskId)
          await patchTaskStatus(
            {
              task: {
                id: taskId,
              },
              taskStatusToUpdate: 'failed',
              statusReasonToUpdate: JSON.stringify(error),
            },
            oystehr
          );
      } catch (patchError) {
        console.error('Error patching task status in top level catch:', patchError);
      }
      throw error;
    }
  } catch (error: unknown) {
    try {
      if (oystehr && taskId)
        await patchTaskStatus(
          {
            task: {
              id: taskId,
            },
            taskStatusToUpdate: 'failed',
            statusReasonToUpdate: JSON.stringify(error),
          },
          oystehr
        );
    } catch (patchError) {
      console.error('Error patching task status in top level catch:', patchError);
    }
    throw error;
  }
});
