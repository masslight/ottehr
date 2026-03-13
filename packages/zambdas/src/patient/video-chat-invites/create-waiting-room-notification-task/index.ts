import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getFullestAvailableName,
  OttehrTaskSystem,
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_TYPE,
  VideoChatNotificationResponse,
} from 'utils';
import { ottehrCodeSystemUrl } from 'utils/lib/fhir/systemUrls';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  lambdaResponse,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { ValidatedInput, validateInput, validateSecrets } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'video-chat-waiting-room-notification';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const response = await performEffect(validatedInput, oystehr);

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, { error: error.message });
  }
});

export async function performEffect(
  validatedInput: ValidatedInput,
  oystehr: Oystehr
): Promise<VideoChatNotificationResponse> {
  const { appointmentId } = validatedInput.body;

  const failureResponse = {
    taskCreated: false,
    taskNotCreatedReason: '',
  };

  console.group('getFhirResources');
  const { appointment, encounter, patient } = await getFhirResources(oystehr, appointmentId);
  console.groupEnd();
  console.debug('getFhirResources success');
  if (!appointment.id || !encounter.id || !patient.id) {
    failureResponse.taskNotCreatedReason = 'Appointment, encounter, or patient not found';
    return failureResponse;
  }

  const notificationSentTag = {
    system: VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_TYPE,
    code: VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
  };

  if (
    appointment.meta?.tag?.some(
      (tag) => tag.system === notificationSentTag.system && tag.code === notificationSentTag.code
    )
  ) {
    failureResponse.taskNotCreatedReason = 'Notification already sent for this appointment';
    return failureResponse;
  }

  const providerReference = encounter.participant?.find(
    (participant) => participant.individual?.reference?.startsWith('Practitioner/')
  )?.individual?.reference;

  console.group('createNewTask');
  const newTask = createNewTask({ appointment, encounter, patient, providerReference });
  console.groupEnd();
  console.debug('createNewTask success');

  const task = await oystehr.fhir.create(newTask);
  if (!task.id) {
    failureResponse.taskNotCreatedReason = 'Failed to create task';
    return failureResponse;
  }

  await oystehr.fhir.patch({
    resourceType: 'Appointment',
    id: appointment.id,
    operations: [
      {
        op: 'add',
        path: appointment.meta != null ? '/meta/-' : '/meta',
        value: appointment.meta != null ? notificationSentTag : [notificationSentTag],
      },
    ],
  });

  return { taskCreated: true };
}

type ReturnedResources = {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
};

async function getFhirResources(
  oystehr: Oystehr,
  appointmentId: string
): Promise<{ appointment: Appointment; encounter: Encounter; patient: Patient }> {
  const resourcesResponse = await oystehr.fhir.search<Appointment | Encounter | Patient>({
    resourceType: 'Appointment',
    params: [
      {
        name: '_id',
        value: appointmentId,
      },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_revinclude',
        value: 'Encounter:appointment',
      },
    ],
  });
  const resources = resourcesResponse.unbundle();
  const appointment = resources.find((resource) => resource.resourceType === 'Appointment') as Appointment;
  const encounter = resources.find((resource) => resource.resourceType === 'Encounter') as Encounter;
  const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
  return {
    appointment,
    encounter,
    patient,
  };
}

const createNewTask = ({
  appointment,
  encounter,
  patient,
  providerReference,
}: ReturnedResources & { providerReference?: string }): Task => {
  const patientName = getFullestAvailableName(patient);
  const locationReference = appointment.participant?.find(
    (participant) => participant.actor?.reference?.startsWith('Location/')
  )?.actor?.reference;
  const newTask: Task = {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
    description: `${patientName} is ready to begin their virtual visit.`,
    code: {
      coding: [
        {
          system: OttehrTaskSystem,
          code: VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
        },
      ],
    },
    encounter: { reference: `Encounter/${encounter.id}` },
    authoredOn: DateTime.now().toISO(),
    input: [
      {
        type: {
          coding: [
            {
              system: ottehrCodeSystemUrl('task-input'),
              code: 'string',
            },
          ],
        },
        valueString: patientName,
        valueReference: { reference: `Patient/${patient.id}` },
      },
    ],
    requester: {
      type: 'Patient',
      reference: `Patient/${patient.id}`,
    },
    ...(locationReference && { location: { reference: locationReference } }),
    focus: {
      type: 'Appointment',
      reference: `Appointment/${appointment.id}`,
    },
    ...(providerReference && { owner: { reference: providerReference } }),
  };
  return newTask;
};
