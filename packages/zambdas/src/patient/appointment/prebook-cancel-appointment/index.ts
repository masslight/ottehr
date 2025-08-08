import { BatchInputDeleteRequest, BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, HealthcareService, Location, Patient, Practitioner, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  CancelAppointmentZambdaInput,
  CancelAppointmentZambdaOutput,
  CancellationReasonCodesInPerson,
  CANT_CANCEL_CHECKED_IN_APT_ERROR,
  DATETIME_FULL_NO_YEAR,
  FHIR_ZAPEHR_URL,
  formatPhoneNumberDisplay,
  getAddressStringForScheduleResource,
  getAppointmentMetaTagOpForStatusUpdate,
  getAppointmentResourceById,
  getNameFromScheduleResource,
  getPatchBinary,
  getPatientContactEmail,
  getPatientFirstName,
  getRelatedPersonForPatient,
  getSecret,
  isAppointmentVirtual,
  isPostTelemedAppointment,
  POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  AuditableZambdaEndpoints,
  checkIsEHRUser,
  createAuditEvent,
  createOystehrClient,
  getAuth0Token,
  getEncounterDetails,
  getUser,
  sendErrors,
  topLevelCatch,
  validateBundleAndExtractAppointment,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getEmailClient } from '../../../shared/communication';
import { validateRequestParameters } from './validateRequestParameters';

export interface CancelAppointmentZambdaInputValidated extends CancelAppointmentZambdaInput {
  secrets: Secrets | null;
}
interface CancellationDetails {
  startTime: DateTime;
  email: string | undefined;
  patient: Patient;
  visitType: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler('cancel-appointment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    console.log('getting user');
    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(input.headers.Authorization.replace('Bearer ', ''), input.secrets));
    const isEHRUser = checkIsEHRUser(user);
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, language: languageInput, cancellationReason, silent, secrets } = validatedParameters;
    const language = languageInput || 'en';
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Get email props
    console.group('gettingEmailProps');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

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
        if (isAppointmentVirtual(appointment)) {
          // https://github.com/masslight/ottehr/issues/2431
          // todo: remove this once prebooked virtual appointments begin in 'booked' status
          console.log(`appointment is virtual, allowing cancellation`);
        } else {
          throw CANT_CANCEL_CHECKED_IN_APT_ERROR;
        }
      }
    } else {
      console.log('cancelled by EHR user');
    }

    // stamp critical update tag so this event can be surfaced in activity logs
    const formattedUserNumber = formatPhoneNumberDisplay(user?.name.replace('+1', ''));
    const cancelledBy = isEHRUser
      ? `Staff ${user?.email}`
      : `Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;

    const appointmentPatchOperations: Operation[] = [
      ...getAppointmentMetaTagOpForStatusUpdate(appointment, 'cancelled', { updatedByOverride: cancelledBy }),
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

    const slotId = appointment.slot?.[0]?.reference?.split('/')[1];
    const deleteSlotRequests: BatchInputDeleteRequest[] = [];
    if (slotId) {
      deleteSlotRequests.push({
        url: `/Slot/${slotId}`,
        method: 'DELETE',
      });
    }

    const getAppointmentRequest: BatchInputGetRequest = {
      url: `/Appointment?_id=${appointmentID}&_include=Appointment:patient&_include=Appointment:actor`,
      method: 'GET',
    };
    console.log('making transaction request for getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest');
    const transactionBundle = await oystehr.fhir.transaction<
      Appointment | Encounter | Schedule | ScheduleOwnerFhirResource
    >({
      requests: [getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest, ...deleteSlotRequests],
    });
    console.log('getting appointment from transaction bundle');
    const {
      appointment: appointmentUpdated,
      scheduleResource,
      patient,
    } = validateBundleAndExtractAppointment(transactionBundle);

    const { startTime, email } = await getCancellationDetails(appointmentUpdated, patient, scheduleResource);
    console.groupEnd();
    console.debug('gettingEmailProps success');

    console.log('building location information');
    //const locationInformation: AvailableLocationInformation = getLocationInformation(oystehr, scheduleResource);

    if (!silent) {
      if (email) {
        console.group('sendCancellationEmail');
        try {
          const emailClient = getEmailClient(secrets);
          const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
          const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

          const address = getAddressStringForScheduleResource(scheduleResource);
          if (!address) {
            throw new Error('Address is required to send reminder email');
          }
          const location = getNameFromScheduleResource(scheduleResource);
          if (!location) {
            throw new Error('Location is required to send reminder email');
          }

          const templateData = {
            time: readableTime,
            location,
            address,
            'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
            'book-again-url': `${WEBSITE_URL}/home`,
          };
          await emailClient.sendInPersonCancelationEmail(email, templateData);
        } catch (error: any) {
          console.error('error sending cancellation email', error);
        }
        console.groupEnd();
      } else {
        console.log('No email found. Skipping sending email.');
      }

      console.group('Send cancel message request');
      const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);

      // todo should this url be formatted according the type of appointment being cancelled?
      const url = `${WEBSITE_URL}/home`;

      const message = `Your visit for ${getPatientFirstName(
        patient
      )} has been canceled. Tap ${url} to book a new visit.`;
      // cSpell:disable-next Spanish
      const messageSpanish = `Su consulta para ${getPatientFirstName(
        patient
        // cSpell:disable-next Spanish
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
        console.log('sending text message to relatedperson', relatedPerson.id);
        try {
          await oystehr.transactionalSMS.send({
            resource: `RelatedPerson/${relatedPerson.id}`,
            message: selectedMessage,
          });
        } catch (e) {
          console.log('failing silently, error sending cancellation text message');
          const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
          void sendErrors(e, ENVIRONMENT);
        }
      } else {
        console.log(`No RelatedPerson found for patient ${patient.id} not sending text message`);
      }
      console.groupEnd();
    } else {
      console.log('Cancelling silently. Skipping email and text.');
    }

    await createAuditEvent(AuditableZambdaEndpoints.appointmentCancel, oystehr, input, patient.id || '', secrets);

    const response: CancelAppointmentZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('cancel-appointment', error, ENVIRONMENT);
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
      startTime: DateTime.fromISO(appointment.start).setZone(timezone),
      email,
      patient,
      visitType,
    };
  } catch (error: any) {
    throw new Error(`error getting cancellation email details: ${error}, ${JSON.stringify(error)}`);
  }
};
