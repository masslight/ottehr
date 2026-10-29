import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TASK_ASSIGNED_DATE_TIME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getFullName } from 'utils/lib/fhir/patient';
import { CreateManualTaskRequest, ERX_TASK, MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getM2MClientId, isM2MClient } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { createTask } from '../../../shared/tasks';
import { ZambdaInput } from '../../../shared/types/common';

let m2mToken: string;

const ZAMBDA_NAME = 'create-manual-task';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);
  const token = input.headers.Authorization.replace('Bearer ', '');
  const isM2M = isM2MClient(token);
  let createdBy: string;
  if (isM2M) {
    createdBy = params.createdBy ?? `M2M Client ${getM2MClientId(token)}`;
  } else {
    const userPractitionerId = await getMyPractitionerId(token, params.secrets);
    const currentUserPractitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: userPractitionerId,
    });
    createdBy = getFullName(currentUserPractitioner);
  }

  const taskBasedOn =
    params.category === MANUAL_TASK.category.radiology && params.orderId
      ? [`ServiceRequest/${params.orderId}`]
      : undefined;

  const taskToCreate = createTask({
    category: params.category,
    title: params.taskTitle,
    code:
      params.category !== MANUAL_TASK.category.erx
        ? undefined
        : params.refillRequest
        ? { system: ERX_TASK.system, code: ERX_TASK.code.refillRequest }
        : params.changeRequest
        ? { system: ERX_TASK.system, code: ERX_TASK.code.changeRequest }
        : undefined,
    encounterId: params.encounterId,
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
        valueString: createdBy,
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
        type: MANUAL_TASK.input.encounterId,
        valueString: params.encounterId,
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
    basedOn: taskBasedOn,
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
});

export function validateRequestParameters(input: ZambdaInput): CreateManualTaskRequest & Pick<ZambdaInput, 'secrets'> {
  const {
    category,
    appointmentId,
    orderId,
    refillRequest,
    changeRequest,
    encounterId,
    taskTitle,
    taskDetails,
    assignee,
    location,
    patient,
    createdBy,
  } = validateJsonBody(input);

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
  if (createdBy !== undefined && typeof createdBy !== 'string') throw INVALID_INPUT_ERROR('createdBy must be a string');
  if (refillRequest === true && changeRequest === true) {
    throw INVALID_INPUT_ERROR('A task is a refill request or a change request, not both');
  }
  if ((refillRequest === true || changeRequest === true) && !orderId) {
    throw INVALID_INPUT_ERROR('A refill or change request needs a prescription');
  }
  if (missingFields.length > 0) throw new Error(`Missing required fields [${missingFields.join(', ')}]`);

  return {
    category,
    appointmentId,
    orderId,
    refillRequest: refillRequest === true,
    changeRequest: changeRequest === true,
    encounterId,
    taskTitle,
    taskDetails,
    assignee,
    location,
    patient,
    createdBy: createdBy?.trim() || undefined,
    secrets: input.secrets,
  };
}
