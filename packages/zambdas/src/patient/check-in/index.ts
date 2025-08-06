import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Location, Patient, QuestionnaireResponse, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  CheckInInput,
  CheckInZambdaOutput,
  formatPhoneNumberDisplay,
  getAppointmentMetaTagOpForStatusUpdate,
  getEncounterStatusHistoryIdx,
  getLocationInformation,
  getPatchBinary,
  getSecret,
  getTaskResource,
  isNonPaperworkQuestionnaireResponse,
  Secrets,
  SecretsKeys,
  TaskIndicator,
  VisitType,
} from 'utils';
import {
  checkPaperworkComplete,
  createOystehrClient,
  getAuth0Token,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getUser } from '../../shared/auth';
import { AuditableZambdaEndpoints, createAuditEvent } from '../../shared/userAuditLog';
import { validateRequestParameters } from './validateRequestParameters';

export interface CheckInInputValidated extends CheckInInput {
  secrets: Secrets;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler('check-in', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.time('check-in-zambda');

    console.group('validateRequestParameters');
    console.log('getting user');
    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(userToken, input.secrets));
    const formattedUserNumber = formatPhoneNumberDisplay(user?.name.replace('+1', ''));
    const checkedInBy = `Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;
    const validatedParameters = validateRequestParameters(input);
    const { appointmentId: appointmentID, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    console.log('getting all fhir resources');
    console.time('resource search for check in');
    const allResources = (
      await oystehr.fhir.search<Appointment | Encounter | Location | Patient | QuestionnaireResponse>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_id',
            value: appointmentID,
          },
          {
            name: '_include',
            value: 'Appointment:location',
          },
          {
            name: '_revinclude',
            value: 'Encounter:appointment',
          },
          {
            name: '_include',
            value: 'Appointment:patient',
          },
          {
            name: '_revinclude:iterate',
            value: 'QuestionnaireResponse:encounter',
          },
        ],
      })
    )
      .unbundle()
      .filter((resource) => isNonPaperworkQuestionnaireResponse(resource) === false);
    console.timeEnd('resource search for check in');

    let appointment: Appointment | undefined,
      patient: Patient | undefined,
      encounter: Encounter | undefined,
      questionnaireResponse: QuestionnaireResponse | undefined,
      location: Location | undefined;

    allResources.forEach((resource) => {
      if (resource.resourceType === 'Appointment') {
        appointment = resource as Appointment;
      }
      if (resource.resourceType === 'Patient') {
        patient = resource as Patient;
      }
      if (resource.resourceType === 'Encounter') {
        encounter = resource as Encounter;
      }
      if (resource.resourceType === 'Location') {
        location = resource as Location;
      }
      if (resource.resourceType === 'QuestionnaireResponse') {
        questionnaireResponse = resource as QuestionnaireResponse;
      }
    });

    if (!appointment) {
      throw APPOINTMENT_NOT_FOUND_ERROR;
    }

    const missingResources = `${!patient ? 'patient, ' : ''}${!encounter ? 'encounter, ' : ''}${
      !location ? 'location, ' : ''
    }`;
    if (!encounter || !patient || !location) {
      throw new Error(`The following vital resources are missing: ${missingResources}`);
    }

    const checkedIn = appointment.status !== 'booked';
    if (!checkedIn) {
      console.log('checking in the patient');
      await checkIn(oystehr, checkedInBy, appointment, encounter);
      await createAuditEvent(AuditableZambdaEndpoints.appointmentCheckIn, oystehr, input, patient.id || '', secrets);
    } else {
      console.log('Appointment is already checked in');
    }

    let paperworkCompleted = false;
    if (questionnaireResponse) {
      paperworkCompleted = checkPaperworkComplete(questionnaireResponse);
    }

    console.log('organizing location information');
    const locationInformation = getLocationInformation(location);

    console.timeEnd('check-in-zambda');

    if (!appointment.start) {
      throw new Error('Appointment start time is missing');
    }

    const response: CheckInZambdaOutput = {
      location: locationInformation,
      visitType: appointment.appointmentType?.text as VisitType, // TODO safely check value is a VisitType
      start: appointment.start,
      paperworkCompleted,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('check-in', error, ENVIRONMENT);
  }
});

async function checkIn(
  oystehr: Oystehr,
  checkedInBy: string,
  appointment: Appointment,
  encounter: Encounter
): Promise<void> {
  const now = DateTime.now().setZone('UTC').toISO() || '';

  const plannedHistoryIdx = getEncounterStatusHistoryIdx(encounter, 'planned');
  console.log('planned history index:', plannedHistoryIdx);

  const arrivedHistoryIdx = getEncounterStatusHistoryIdx(encounter, 'arrived');
  console.log('arrived history index:', arrivedHistoryIdx);

  console.log('current encounter status history:', JSON.stringify(encounter.statusHistory));

  const encounterPatchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: 'arrived',
    },
  ];
  if (plannedHistoryIdx >= 0) {
    encounterPatchOperations.push({
      op: 'add',
      path: `/statusHistory/${plannedHistoryIdx}/period/end`,
      value: now,
    });
  }
  if (arrivedHistoryIdx === -1) {
    encounterPatchOperations.push({
      op: 'add',
      path: `/statusHistory/-`,
      value: {
        status: 'arrived',
        period: {
          start: now,
        },
      },
    });
  }

  const appointmentPatchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: 'arrived',
    },
  ];
  appointmentPatchOperations.push(
    ...getAppointmentMetaTagOpForStatusUpdate(appointment, 'arrived', { updatedByOverride: checkedInBy })
  );

  const appointmentPatchRequest = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: appointment.id || 'Unknown',
    patchOperations: appointmentPatchOperations,
  });
  const encounterPatchRequest = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: encounter.id || 'Unknown',
    patchOperations: encounterPatchOperations,
  });

  const checkInTextTask = getTaskResource(TaskIndicator.checkInText, appointment.id || '');
  const taskRequest: BatchInputPostRequest<Task> = {
    method: 'POST',
    url: '/Task',
    resource: checkInTextTask,
  };

  console.log('making transaction request to patch appointment and encounter and create task to send text');
  await oystehr.fhir.transaction({
    requests: [appointmentPatchRequest, encounterPatchRequest, taskRequest],
  });
}
