import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, DiagnosticReport, Task } from 'fhir/r4b';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { Secrets, UpdateLabOrderResourceParams } from 'utils';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`update-lab-order-resources started, input: ${JSON.stringify(input)}`);
  let secrets = input.secrets;
  let validatedParameters: (UpdateLabOrderResourceParams & { secrets: Secrets | null; userToken: string }) | null =
    null;

  try {
    validatedParameters = validateRequestParameters(input);
    secrets = validatedParameters.secrets;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    const practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

    const { taskId, event } = validatedParameters;

    if (event === 'reviewed') {
      const updateTransactionRequest = await handleReviewedEvent(oystehr, practitionerIdFromCurrentUser, taskId);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Successfully updated Task/${taskId}. Status set to 'completed' and Practitioner set.`,
          transaction: updateTransactionRequest,
        }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `action not supported for event: ${validatedParameters.event}`,
      }),
    };
  } catch (error: any) {
    console.error('Error updating lab order resource:', error);
    await topLevelCatch('update-lab-order-resources', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error updating lab order resource: ${error.message || error}`,
        requestParameters: validatedParameters
          ? {
              taskId: validatedParameters.taskId,
            }
          : 'validation failed',
      }),
    };
  }
};

const handleReviewedEvent = async (
  oystehr: Oystehr,
  practitionerIdFromCurrentUser: string,
  taskId: string
): Promise<
  Bundle<{
    resourceType: 'Binary';
    contentType: string;
    data: string;
  }>
> => {
  const resources = (
    await oystehr.fhir.search<Task | DiagnosticReport>({
      resourceType: 'Task',
      params: [{ name: '_id', value: taskId }],
    })
  ).unbundle();

  const tasks = resources.filter((resource) => resource.resourceType === 'Task');
  if (tasks.length !== 1) {
    throw new Error(`Invalid number of tasks found: tasks: ${tasks?.length}`);
  }

  const task = tasks[0];

  if (task.status !== 'ready') {
    throw new Error(`Task/${taskId} status is '${task.status}', not 'ready'.`);
  }

  // Set task status to completed and set owner to current practitioner
  const updateTransactionRequest = await oystehr.fhir.transaction({
    requests: [
      {
        method: 'PATCH',
        url: `/Task/${taskId}`,
        resource: {
          resourceType: 'Binary',
          contentType: 'application/json-patch+json',
          data: Buffer.from(
            JSON.stringify([
              {
                op: 'replace',
                path: '/status',
                value: 'completed',
              },
              {
                op: 'add',
                path: '/owner',
                value: {
                  reference: `Practitioner/${practitionerIdFromCurrentUser}`,
                },
              },
              // todo: add provenance, and update UI history view
            ])
          ).toString('base64'),
        },
      },
    ],
  });

  return updateTransactionRequest;
};
