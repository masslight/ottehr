import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Location, Patient, QuestionnaireResponse, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  formatPhoneNumberDisplay,
  getCriticalUpdateTagOp,
  getPatchBinary,
  getTaskResource,
  TaskIndicator,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, topLevelCatch } from 'zambda-utils';
import '../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../shared';
import { getUser } from '../shared/auth';
import {
  checkPaperworkComplete,
  createOystehrClient,
  getEncounterStatusHistoryIdx,
  getLocationInformation,
} from '../shared/helpers';
import { AuditableZambdaEndpoints, createAuditEvent } from '../shared/userAuditLog';
import { validateRequestParameters } from './validateRequestParameters';

export interface CheckInInput {
  appointment: string;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('check-in', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.time('check-in-zambda');

    console.group('validateRequestParameters');
    console.log('getting user');
    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(userToken, input.secrets));
    const formattedUserNumber = formatPhoneNumberDisplay(user?.name.replace('+1', ''));
    const checkedInBy = `Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;
    const validatedParameters = validateRequestParameters(input);
    const { appointment: appointmentID, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    console.log('getting all fhir resources');
    console.time('resource search for checkin');
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
    ).unbundle();
    console.timeEnd('resource search for checkin');

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
      await checkin(oystehr, checkedInBy, appointment, encounter);
      await createAuditEvent(AuditableZambdaEndpoints.appointmentCheckIn, oystehr, input, patient.id || '', secrets);
    } else {
      console.log('Appointment is already checked in');
    }

    let paperworkCompleted = false;
    if (questionnaireResponse) {
      paperworkCompleted = checkPaperworkComplete(questionnaireResponse);
    }

    console.log('organizing location information');
    const locationInformation = getLocationInformation(oystehr, location);

    console.timeEnd('check-in-zambda');

    return {
      statusCode: 200,
      body: JSON.stringify({
        location: locationInformation,
        visitType: appointment.appointmentType?.text,
        start: appointment.start,
        paperworkCompleted,
      }),
    };
  } catch (error: any) {
    return topLevelCatch('check-in', error, input.secrets, captureSentryException);
  }
});

async function checkin(
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
  appointmentPatchOperations.push(getCriticalUpdateTagOp(appointment, checkedInBy));

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
