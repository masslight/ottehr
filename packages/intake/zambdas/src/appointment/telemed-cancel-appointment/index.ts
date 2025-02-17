/* eslint-disable @typescript-eslint/no-unused-vars */
import { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, HealthcareService, Location, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  CancellationReasonOptionsTelemed,
  FHIR_ZAPEHR_URL,
  SLUG_SYSTEM,
  cancelAppointmentResource,
  createOystehrClient,
  getAppointmentResourceById,
  getPatchBinary,
  getRelatedPersonForPatient,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, SecretsKeys, getSecret } from 'zambda-utils';
import {
  AuditableZambdaEndpoints,
  checkOrCreateM2MClientToken,
  createAuditEvent,
  getVideoEncounterForAppointment,
  sendSms,
} from '../../shared';
import { sendVirtualCancellationEmail } from '../../shared/communication';
import { validateBundleAndExtractAppointment } from '../../shared/validateBundleAndExtractAppointment';
import { getPatientContactEmail } from '../telemed-create-appointment';
import { validateRequestParameters } from './validateRequestParameters';
export interface CancelAppointmentInput {
  appointmentID: string;
  cancellationReason: CancellationReasonOptionsTelemed;
  cancellationReasonAdditional?: string;
  secrets: Secrets | null;
}

interface CancellationDetails {
  startTime: string | undefined;
  email: string | undefined;
  patient: Patient;
  scheduleResource: Location | HealthcareService | Practitioner;
  visitType: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Cancelation Input: ${JSON.stringify(input)}`);

  try {
    const validatedParameters = validateRequestParameters(input);

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, validatedParameters.secrets);

    const response = await performEffect({ input, params: validatedParameters });

    return response;
  } catch (error: any) {
    console.log(`Error: ${error} Error stringified: `, JSON.stringify(error, null, 4));
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
  const { secrets, appointmentID, cancellationReason, cancellationReasonAdditional } = props.params;

  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
  const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);

  console.group('gettingEmailProps');

  const appointmentPatchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: 'cancelled',
    },
  ];

  console.log(`getting encounter details for appointment with id ${appointmentID}`);
  const [encounter, existedAppointment] = await Promise.all([
    getVideoEncounterForAppointment(appointmentID, oystehr),
    getAppointmentResourceById(appointmentID, oystehr),
  ]);
  if (!existedAppointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }
  console.log(`successfully retrieved encounter details for id ${encounter?.id}`);
  const now = DateTime.now().setZone('UTC').toISO() || '';
  const encounterPatchOperations: Operation[] = [];
  if (encounter && encounter.status !== 'cancelled') {
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
      }
    );

    if (encounter.statusHistory && encounter.statusHistory.length > 0) {
      const previousStatusHistoryRecordIndex = encounter.statusHistory.findIndex(
        (historyRecord) => historyRecord.status === encounter.status
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

  const environment = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const status = environment === 'production' ? 'CANC' : '8-CANC';
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
  const transactionBundle = await oystehr.fhir.transaction<Appointment | Encounter>({ requests: requests });
  console.log('getting appointment from transaction bundle');
  const { appointment, scheduleResource, patient } = validateBundleAndExtractAppointment(transactionBundle);
  const visitType =
    appointment.appointmentType?.coding
      ?.find((codingTemp) => codingTemp.system === 'http://terminology.hl7.org/CodeSystem/v2-0276')
      ?.code?.toLowerCase() || 'Unknown';

  console.groupEnd();
  console.debug('gettingEmailProps success');

  console.log(`canceling appointment with id ${appointmentID}`);
  const cancelledAppointment = await cancelAppointmentResource(
    appointment,
    [
      {
        // todo reassess codes and reasons, just using custom codes atm
        system: `${FHIR_ZAPEHR_URL}/CodeSystem/appointment-cancellation-reason`,
        code: CancellationReasonOptionsTelemed[cancellationReason],
        display: cancellationReasonAdditional || cancellationReason,
      },
    ],
    oystehr
  );

  const response = {
    message: 'Successfully canceled an appointment',
    appointment: cancelledAppointment.id ?? null,
    location: {
      name: scheduleResource?.name || 'Unknown',
      slug:
        scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value ||
        'Unknown',
    },
    visitType: visitType,
  };
  console.group('sendCancellationEmail');
  try {
    const email = getPatientContactEmail(patient);
    if (email) {
      await sendVirtualCancellationEmail({
        toAddress: email,
        secrets,
      });
    } else {
      throw Error('no email found');
    }
  } catch (error: any) {
    console.error('error sending cancellation email', error);
  }
  console.groupEnd();

  console.log('Send cancel message request');

  const relatedPerson = await getRelatedPersonForPatient(patient.id || '', oystehr);
  if (relatedPerson) {
    const message = `Sorry to see you go. Questions? Call 202-555-1212 `;

    await sendSms(message, zapehrToken, `RelatedPerson/${relatedPerson.id}`, secrets);
  } else {
    console.log(`No RelatedPerson found for patient ${patient.id} not sending text message`);
  }

  await createAuditEvent(AuditableZambdaEndpoints.appointmentCancel, oystehr, input, patient.id || '', secrets);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}
