import { BatchInputGetRequest } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, HealthcareService, Location, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  AvailableLocationInformation,
  CANT_CANCEL_CHECKEDIN_APT_ERROR,
  CancellationReasonCodesInPerson,
  CancellationReasonOptionsInPerson,
  DATETIME_FULL_NO_YEAR,
  FHIR_ZAPEHR_URL,
  POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR,
  formatPhoneNumberDisplay,
  getAppointmentResourceById,
  getCriticalUpdateTagOp,
  getPatchBinary,
  getPatientContactEmail,
  getPatientFirstName,
  getRelatedPersonForPatient,
  isPostTelemedAppointment,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, SecretsKeys, getSecret, topLevelCatch } from 'zambda-utils';
import { captureSentryException, configSentry, getAuth0Token, sendInPersonCancellationEmail } from '../../shared';
import { getUser } from '../../shared/auth';
import { getEncounterDetails } from '../../shared/getEncounterDetails';
import { createOystehrClient, getLocationInformation } from '../../shared/helpers';
import { AuditableZambdaEndpoints, createAuditEvent } from '../../shared/userAuditLog';
import { validateBundleAndExtractAppointment } from '../../shared/validateBundleAndExtractAppointment';
import { validateRequestParameters } from './validateRequestParameters';

export interface CancelAppointmentInput {
  appointmentID: string;
  cancellationReason: CancellationReasonOptionsInPerson;
  silent?: boolean;
  language: string;
  secrets: Secrets | null;
}

interface CancellationDetails {
  startTime: string;
  email: string | undefined;
  patient: Patient;
  visitType: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('cancel-appointment', input.secrets);
  console.log(`Cancelation Input: ${JSON.stringify(input)}`);

  try {
    console.group('validateRequestParameters');
    console.log('getting user');
    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(input.headers.Authorization.replace('Bearer ', ''), input.secrets));
    const isEHRUser = userToken && !user.name.startsWith('+');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, language: languageInput, cancellationReason, silent, secrets } = validatedParameters;
    const language = languageInput || 'en';
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Get email props
    console.group('gettingEmailProps');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    const appointment: Appointment | undefined = await getAppointmentResourceById(appointmentID, oystehr);
    if (!appointment) {
      throw APPOINTMENT_NOT_FOUND_ERROR;
    }

    if (!isEHRUser) {
      if (isPostTelemedAppointment(appointment)) {
        throw POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR;
      }

      console.log(`checking appointment with id ${appointmentID} is not checked in`);
      if (appointment.status !== 'booked') {
        throw CANT_CANCEL_CHECKEDIN_APT_ERROR;
      }
    } else {
      console.log('cancelled by EHR user');
    }

    // stamp critical update tag so this event can be surfaced in activity logs
    const formattedUserNumber = formatPhoneNumberDisplay(user?.name.replace('+1', ''));
    const cancelledBy = isEHRUser
      ? `Staff ${user?.email} via QRS`
      : `Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;
    const criticalUpdateOp = getCriticalUpdateTagOp(appointment, cancelledBy);

    const appointmentPatchOperations: Operation[] = [
      criticalUpdateOp,
      {
        op: 'replace',
        path: '/status',
        value: 'cancelled',
      },
      {
        op: 'add',
        path: '/cancelationReason',
        value: {
          coding: [
            {
              // todo reassess codes and reasons, just using custom codes atm
              system: `${FHIR_ZAPEHR_URL}/CodeSystem/appointment-cancellation-reason`,
              code: CancellationReasonCodesInPerson[cancellationReason],
              display: cancellationReason,
            },
          ],
        },
      },
    ];

    console.log(`getting encounter details for appointment with id ${appointmentID}`);
    const { encounter, curStatusHistoryIdx, canceledHistoryIdx } = await getEncounterDetails(appointmentID, oystehr);
    console.log(`successfully retrieved encounter details for id ${encounter.id}`);
    const now = DateTime.now().setZone('UTC').toISO() || '';
    const encounterPatchOperations: Operation[] = [
      {
        op: 'replace',
        path: '/status',
        value: 'cancelled',
      },
    ];
    if (curStatusHistoryIdx >= 0) {
      encounterPatchOperations.push({
        op: 'add',
        path: `/statusHistory/${curStatusHistoryIdx}/period/end`,
        value: now,
      });
    }
    if (canceledHistoryIdx === -1) {
      encounterPatchOperations.push({
        op: 'add',
        path: `/statusHistory/-`,
        value: {
          status: 'cancelled',
          period: {
            start: now,
          },
        },
      });
    }

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
      url: `/Appointment?_id=${appointmentID}&_include=Appointment:patient&_include=Appointment:actor`,
      method: 'GET',
    };
    console.log('making transaction request for getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest');
    const transactionBundle = await oystehr.fhir.transaction<Appointment | Encounter>({
      requests: [getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest],
    });
    console.log('getting appointment from transaction bundle');
    const {
      appointment: appointmentUpdated,
      scheduleResource,
      patient,
    } = validateBundleAndExtractAppointment(transactionBundle);

    const { startTime, email, visitType } = await getCancellationDetails(appointmentUpdated, patient, scheduleResource);
    console.groupEnd();
    console.debug('gettingEmailProps success');

    console.log('building location information');
    const locationInformation: AvailableLocationInformation = getLocationInformation(oystehr, scheduleResource);

    const response = {
      message: 'Successfully canceled an appointment',
      appointment: appointmentUpdated.id ?? null,
      location: locationInformation,
      visitType: visitType,
    };

    if (!silent) {
      if (email) {
        console.group('sendCancellationEmail');
        try {
          await sendInPersonCancellationEmail({
            email,
            startTime,
            secrets,
            scheduleResource,
            visitType,
            language,
          });
        } catch (error: any) {
          console.error('error sending cancellation email', error);
        }
        console.groupEnd();
      } else {
        console.log('No email found. Skipping sending email.');
      }

      if (!isEHRUser) {
        console.group('Send cancel message request');
        const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);

        // todo should this url be formated according the type of appointment being cancelled?
        const url = `${WEBSITE_URL}/home`;

        const message = `Your visit for ${getPatientFirstName(
          patient
        )} has been canceled. Tap ${url} to book a new visit.`;
        const messageSpanish = `Su consulta para ${getPatientFirstName(
          patient
        )} ha sido cancelada. Toque ${url} para reservar una nueva consulta.`;

        let selectedMessage;
        switch (language.split('-')[0]) {
          case 'es':
            selectedMessage = messageSpanish;
            break;
          case 'en':
          default:
            selectedMessage = message;
            break;
        }

        const relatedPerson = await getRelatedPersonForPatient(patient.id || '', oystehr);
        if (relatedPerson) {
          try {
            await oystehr.transactionalSMS.send({
              resource: `RelatedPerson/${relatedPerson.id}`,
              message: selectedMessage,
            });
          } catch (e) {
            console.log('failing silently, error sending cancellation text message');
          }
        } else {
          console.log(`No RelatedPerson found for patient ${patient.id} not sending text message`);
        }
        console.groupEnd();
      } else {
        console.log('cancelled by EHR user, not sending text');
      }
    } else {
      console.log('Cancelling silently. Skipping email and text.');
    }

    await createAuditEvent(AuditableZambdaEndpoints.appointmentCancel, oystehr, input, patient.id || '', secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('cancel-appointment', error, input.secrets, captureSentryException);
  }
});

const getCancellationDetails = async (
  appointment: Appointment,
  patient: Patient,
  scheduleResource: Location | HealthcareService | Practitioner
): Promise<CancellationDetails> => {
  try {
    if (!appointment.start) {
      throw new Error(`These fields are required for the cancelation email: appointment.start`);
    }
    const email = getPatientContactEmail(patient);
    const timezone = scheduleResource.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
    )?.valueString;
    const visitType = appointment.appointmentType?.text ?? 'Unknown';

    return {
      startTime: DateTime.fromISO(appointment.start).setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
      email,
      patient,
      visitType,
    };
  } catch (error: any) {
    throw new Error(`error getting cancellation email details: ${error}, ${JSON.stringify(error)}`);
  }
};
