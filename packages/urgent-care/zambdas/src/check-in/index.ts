import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { createFhirClient } from '../shared/helpers';
import { DateTime } from 'luxon';
import { sendMessage } from '../shared/communication';
import { BatchInputGetRequest, FhirClient } from '@zapehr/sdk';
import {
  Secrets,
  ZambdaInput,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getPatientFirstName,
  topLevelCatch,
} from 'utils';
import { Operation } from 'fast-json-patch';
import { getAccessToken, getRelatedPersonForPatient } from '../shared/auth';
import { getConversationSIDForRelatedPersons } from '../create-appointment';
import { LocationInformation, getEncounterDetails } from '../shared/getEncounterDetails';
import { AuditableZambdaEndpoints, createAuditEvent } from '../shared/userAuditLog';
import { validateBundleAndExtractAppointment } from '../shared/validateBundleAndExtractAppointment';
import { Bundle, FhirResource } from 'fhir/r4';
import { getAppointmentResource } from '../shared/fhir';
import { getPatchOperationsToUpdateVisitStatus } from '../shared/other-ehr';

export interface CheckInInput {
  appointment: string;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
let zapehrMessagingToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointment: appointmentID, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);

    const appointment = await getAppointmentResource(appointmentID, fhirClient);

    if (!appointment) {
      throw new Error('Appointment is not found');
    }

    const checkedIn = appointment.status !== 'booked';
    if (checkedIn) {
      console.log('Appointment is already checked in');
    }

    const { patientID, transactionBundle, visitType, location, appointmentStart } = await checkin(
      appointmentID,
      fhirClient,
      checkedIn,
    );

    console.log('getting appointment from transaction bundle');
    const {
      appointment: zapehrAppointment,
      questionnaireResponse,
      patient,
    } = validateBundleAndExtractAppointment(transactionBundle);
    console.log(`zapEHR Appointment ID is ${zapehrAppointment.id}`);

    const paperworkCompleted =
      questionnaireResponse?.status === 'completed' || questionnaireResponse?.status === 'amended';

    if (!checkedIn) {
      if (!zapehrMessagingToken) {
        console.log('getting zapehrMessagingToken');
        zapehrMessagingToken = await getAccessToken(secrets, 'messaging');
      }
      const message = `Welcome, and thanks for checking in! Our care team will do our best to help ${getPatientFirstName(
        patient,
      )} soon. We appreciate your patience!`;
      const relatedPerson = await getRelatedPersonForPatient(patientID || '', fhirClient);
      if (relatedPerson) {
        const conversationSID = await getConversationSIDForRelatedPersons([relatedPerson], fhirClient);
        await sendMessage(message, conversationSID || '', zapehrMessagingToken, secrets);
      } else {
        console.log(`No RelatedPerson found for patient ${patientID} not sending text message`);
      }
    }

    await createAuditEvent(AuditableZambdaEndpoints.appointmentCheckIn, fhirClient, input, patientID || '', secrets);

    return {
      statusCode: 200,
      body: JSON.stringify({
        location: location,
        visitType: visitType,
        start: appointmentStart,
        paperworkCompleted: paperworkCompleted,
      }),
    };
  } catch (error: any) {
    console.log('error', error);
    await topLevelCatch('check-in', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

async function checkin(
  appointmentID: string,
  fhirClient: FhirClient,
  checkedIn: boolean,
): Promise<{
  patientID: string | undefined;
  transactionBundle: Bundle<FhirResource>;
  visitType: string;
  location: LocationInformation;
  appointmentStart: string | undefined;
}> {
  if (checkedIn) {
    console.log('Already checked in and getting appointment details');
  } else {
    console.log('Checking in');
  }
  const appointmentPatchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: 'arrived',
    },
  ];
  console.log(`getting encounter details for appointment id ${appointmentID}`);
  const {
    encounter,
    plannedHistoryIdx,
    arrivedHistoryIdx,
    location,
    visitType,
    appointmentStart,
    appointment,
    patientID,
  } = await getEncounterDetails(appointmentID, fhirClient);
  console.log('successfully retrieved encounter details');
  const now = DateTime.now().setZone('UTC').toISO();
  console.log('current encounter status history:', JSON.stringify(encounter.statusHistory));
  console.log('planned history index:', plannedHistoryIdx);
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
  appointmentPatchOperations.push(...getPatchOperationsToUpdateVisitStatus(appointment, 'ARRIVED', now || undefined));
  const appointmentPatchRequest = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: appointmentID,
    patchOperations: appointmentPatchOperations,
  });
  const encounterPatchRequest = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: encounter.id || 'Unknown',
    patchOperations: encounterPatchOperations,
  });
  const getAppointmentRequest: BatchInputGetRequest = {
    url: `/Appointment?_id=${appointmentID}&_include=Appointment:patient&_include=Appointment:location&_revinclude:iterate=Encounter:appointment&_revinclude:iterate=QuestionnaireResponse:encounter`,
    method: 'GET',
  };
  let requests = [];
  if (checkedIn) {
    console.log('Making transaction request for getAppointmentRequest');
    requests = [getAppointmentRequest];
  } else {
    console.log('Making transaction request for getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest');
    requests = [getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest];
  }
  const transactionBundle = await fhirClient.transactionRequest({
    requests,
  });

  return { patientID, transactionBundle, visitType, location, appointmentStart };
}
