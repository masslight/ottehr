import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateManualTaskRequest,
  getFullName,
  getSecret,
  MANUAL_TASK,
  SecretsKeys,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
} from 'utils';
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
      location: {
        id: params.location.id,
        name: params.location.name,
      },
      input: [
        {
          type: MANUAL_TASK.input.title,
          valueString: params.taskTitle,
        },
        {
          type: MANUAL_TASK.input.details,
          valueString: params.taskDetails,
        },
        {
          type: MANUAL_TASK.input.providerName,
          valueString: getFullName(currentUserPractitioner),
        },
        {
          type: MANUAL_TASK.input.appointmentId,
          valueString: params.appointmentId,
        },
        {
          type: MANUAL_TASK.input.orderId,
          valueString: params.orderId,
        },
        {
          type: MANUAL_TASK.input.patient,
          valueReference: params.patient
            ? {
                reference: 'Patient/' + params.patient.id,
                display: params.patient.name,
              }
            : undefined,
        },
      ],
    });

    if (params.assignee) {
      taskToCreate.owner = {
        reference: 'Practitioner/' + params.assignee.id,
        display: params.assignee.name,
        extension: [
          {
            url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
            valueDateTime: DateTime.now().toISO(),
          },
        ],
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
  const { category, appointmentId, orderId, taskTitle, taskDetails, assignee, location, patient } =
    validateJsonBody(input);

  const missingFields: string[] = [];
  if (!category) missingFields.push('category');
  if (!taskTitle) missingFields.push('taskTitle');
  if (!location) missingFields.push('location');
  if (location) {
    if (!location.id) missingFields.push('location.id');
    if (!location.name) missingFields.push('location.name');
  }
  if (assignee) {
    if (!assignee.id) missingFields.push('assignee.id');
    if (!assignee.name) missingFields.push('assignee.name');
  }
  if (patient) {
    if (!patient.id) missingFields.push('patient.id');
    if (!patient.name) missingFields.push('patient.name');
  }
  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    category,
    appointmentId,
    orderId,
    taskTitle,
    taskDetails,
    assignee,
    location,
    patient,
    secrets: input.secrets,
  };
}
