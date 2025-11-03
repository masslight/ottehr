import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { CreateManualTaskRequest, getFullName, getSecret, MANUAL_TASK, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createTask } from '../../../shared/tasks';

let m2mToken: string;

const ZAMBDA_NAME = 'create-manual-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createOystehrClient(m2mToken, params.secrets);
    const userToken = input.headers.Authorization.replace('Bearer ', '');
    const oystehrCurrentUser = createOystehrClient(userToken, params.secrets);
    const userPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    const currentUserPractitioner = await oystehrCurrentUser.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: userPractitionerId,
    });

    const taskToCreate = createTask({
      category: params.category,
      locationId: params.locationId,
      input: [
        {
          type: MANUAL_TASK.input.title,
          value: params.taskTitle,
        },
        {
          type: MANUAL_TASK.input.details,
          value: params.taskDetails,
        },
        {
          type: MANUAL_TASK.input.providerName,
          value: getFullName(currentUserPractitioner),
        },
        {
          type: MANUAL_TASK.input.appointmentId,
          value: params.appointmentId,
        },
        {
          type: MANUAL_TASK.input.orderId,
          value: params.orderId,
        },
      ],
    });

    if (params.assignee) {
      taskToCreate.owner = {
        reference: 'Practitioner/' + params.assignee.id,
        display: params.assignee.name,
      };
      taskToCreate.status = 'in-progress';
    }

    const createdTask = await oystehr.fhir.create(taskToCreate);

    return {
      statusCode: 200,
      body: JSON.stringify(createdTask),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

export function validateRequestParameters(input: ZambdaInput): CreateManualTaskRequest & Pick<ZambdaInput, 'secrets'> {
  const { category, appointmentId, orderId, taskTitle, taskDetails, assignee, locationId } = validateJsonBody(input);

  const missingFields: string[] = [];
  if (!category) missingFields.push('category');
  if (!taskTitle) missingFields.push('taskTitle');
  if (!locationId) missingFields.push('locationId');
  if (assignee) {
    if (!assignee.id) missingFields.push('assignee.id');
    if (!assignee.name) missingFields.push('assignee.name');
  }
  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    category,
    appointmentId,
    orderId,
    taskTitle,
    taskDetails,
    assignee,
    locationId,
    secrets: input.secrets,
  };
}
