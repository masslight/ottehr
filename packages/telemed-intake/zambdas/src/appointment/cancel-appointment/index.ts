/* eslint-disable @typescript-eslint/no-unused-vars */
import { BatchInputGetRequest, FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Location, Patient } from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  Secrets,
  SecretsKeys,
  ZambdaInput,
  getPatchBinary,
  getSecret,
  cancelAppointmentResource,
  createFhirClient,
  getParticipantFromAppointment,
} from 'ottehr-utils';
import { AuditableZambdaEndpoints, createAuditEvent, getVideoEncounterForAppointment } from '../../shared';
import { sendCancellationEmail } from '../../shared/communication';
import { getPatientResource } from '../../shared/fhir';
import { getRelatedPersonForPatient } from '../../shared/patients';
import { validateBundleAndExtractAppointment } from '../../shared/validateBundleAndExtractAppointment';
import { CancellationReasonOptions } from '../../types';
import { getPatientContactEmail } from '../create-appointment';
import { checkOrCreateToken } from '../lib/utils';
import { validateRequestParameters } from './validateRequestParameters';
import { getConversationSIDForRelatedPersons } from '../create-appointment/logic/conversation';

export interface CancelAppointmentInput {
  appointmentID: string;
  cancellationReason: CancellationReasonOptions;
  secrets: Secrets | null;
}

interface CancellationDetails {
  startTime: string;
  email: string;
  patient: Patient;
  location: Location;
  visitType: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Cancelation Input: ${JSON.stringify(input)}`);

  try {
    const validatedParameters = validateRequestParameters(input);

    zapehrToken = await checkOrCreateToken(zapehrToken, validatedParameters.secrets);

    const response = await performEffect({ input, params: validatedParameters });

    return response;
  } catch (error: any) {
    console.log('Error:', JSON.stringify(error, null, 4));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

interface PerformEffectInput {
  input: ZambdaInput;
  params: CancelAppointmentInput;
}

async function performEffect(props: PerformEffectInput): Promise<APIGatewayProxyResult> {
  const { input } = props;
  const { secrets, appointmentID, cancellationReason } = props.params;

  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const fhirClient = createFhirClient(zapehrToken, fhirAPI);

  console.group('gettingEmailProps');

  const appointmentPatchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: 'cancelled',
    },
  ];

  console.log(`getting encounter details for appointment with id ${appointmentID}`);
  const encounter = await getVideoEncounterForAppointment(appointmentID, fhirClient);
  console.log(`successfully retrieved encounter details for id ${encounter?.id}`);
  const encounterPatchOperations: Operation[] = [];
  if (encounter && encounter.status !== 'cancelled') {
    const now = DateTime.now().setZone('UTC').toISO();
    encounterPatchOperations.push(
      {
        op: 'replace',
        path: '/status',
        value: 'cancelled',
      },
      {
        op: 'add',
        path: `/statusHistory/-`,
        value: {
          status: 'cancelled',
          period: {
            start: now,
          },
        },
      },
    );

    if (encounter.statusHistory && encounter.statusHistory.length > 0) {
      const previousStatusHistoryRecordIndex = encounter.statusHistory.findIndex(
        (historyRecord) => historyRecord.status === encounter.status,
      );

      if (
        previousStatusHistoryRecordIndex !== -1 &&
        !encounter.statusHistory[previousStatusHistoryRecordIndex].period.end
      ) {
        encounterPatchOperations.push({
          op: 'add',
          path: `/statusHistory/${previousStatusHistoryRecordIndex}/period/end`,
          value: now,
        });
      }
    }
  }

  const appointmentPatchRequest = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: appointmentID,
    patchOperations: appointmentPatchOperations,
  });
  const encounterPatchRequest = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: encounter?.id || 'Unknown',
    patchOperations: encounterPatchOperations,
  });
  const getAppointmentRequest: BatchInputGetRequest = {
    url: `/Appointment?_id=${appointmentID}&_include=Appointment:patient&_include=Appointment:location`,
    method: 'GET',
  };
  console.log('making transaction request for getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest');
  const requests = [getAppointmentRequest, appointmentPatchRequest];
  if (encounterPatchOperations.length > 0) {
    requests.push(encounterPatchRequest);
  }
  const transactionBundle = await fhirClient.transactionRequest({ requests: requests });
  console.log('getting appointment from transaction bundle');
  const { appointment } = validateBundleAndExtractAppointment(transactionBundle);

  // todo: this could be done in the same request to get the appointment

  const { startTime, email, patient, location, visitType } = await getCancellationEmailDetails(appointment, fhirClient);
  console.groupEnd();
  console.debug('gettingEmailProps success');

  console.log(`canceling appointment with id ${appointmentID}`);
  const cancelledAppointment = await cancelAppointmentResource(appointment, cancellationReason, fhirClient);

  const response = {
    message: 'Successfully canceled an appointment',
    appointment: cancelledAppointment.id ?? null,
    location: {
      name: location?.name || 'Unknown',
      slug:
        location.identifier?.find((identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/slug')
          ?.value || 'Unknown',
    },
    visitType: visitType,
  };
  console.group('sendCancellationEmail');
  await sendCancellationEmail({
    email,
    startTime,
    secrets,
    location,
    visitType,
  });
  console.groupEnd();

  console.log('Send cancel message request');
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const message = `Your visit with Ottehr Urgent Care ${location.name} has been canceled. Tap ${WEBSITE_URL}/location/${response.location.slug}/${response.visitType} to book a new visit.`;

  const relatedPerson = await getRelatedPersonForPatient(patient.id || '', fhirClient);
  if (relatedPerson) {
    const conversationSID = await getConversationSIDForRelatedPersons([relatedPerson], fhirClient);
    // await sendMessage(message, conversationSID || '', zapehrMessagingToken, secrets);
  } else {
    console.log(`No RelatedPerson found for patient ${patient.id} not sending text message`);
  }

  await createAuditEvent(AuditableZambdaEndpoints.appointmentCancel, fhirClient, input, patient.id || '', secrets);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}

const getCancellationEmailDetails = async (
  appointment: Appointment,
  fhirClient: FhirClient,
): Promise<CancellationDetails> => {
  try {
    const patientID = getParticipantFromAppointment(appointment, 'Patient');
    console.log(`getting patient details for ${patientID}`);
    const patient: Patient = await getPatientResource(patientID, fhirClient);
    const email = getPatientContactEmail(patient);

    const locationId = appointment.participant
      .find((appt) => appt.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.replace('Location/', '');
    console.log('got location id', locationId);
    // todo: wouldn't it be better to cancel the appointment and not send an email if the only thing missing here is email??
    if (!locationId || !email || !appointment.start) {
      throw new Error(`These fields are required for the cancelation email: locationId, email, appointment.start`);
    }

    console.log(`getting location resource for ${locationId}`);
    const location: Location = await fhirClient.readResource({
      resourceType: 'Location',
      resourceId: locationId,
    });
    const timezone = location.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
    )?.valueString;

    const visitType =
      appointment.appointmentType?.coding
        ?.find((codingTemp) => codingTemp.system === 'http://terminology.hl7.org/CodeSystem/v2-0276')
        ?.code?.toLowerCase() || 'Unknown';
    const DATETIME_FULL_NO_YEAR = 'MMMM d, h:mm a ZZZZ';
    return {
      startTime: DateTime.fromISO(appointment.start).setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
      email,
      patient,
      location,
      visitType,
    };
  } catch (error: any) {
    throw new Error(`error getting cancellation email details: ${error}, ${JSON.stringify(error)}`);
  }
};
