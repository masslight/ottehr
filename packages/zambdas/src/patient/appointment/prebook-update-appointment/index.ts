import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, HealthcareService, Location, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_CANT_BE_IN_PAST_ERROR,
  CANT_UPDATE_CANCELED_APT_ERROR,
  CANT_UPDATE_CHECKED_IN_APT_ERROR,
  DATETIME_FULL_NO_YEAR,
  PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  getAvailableSlotsForSchedule,
  getPatientContactEmail,
  getPatientFirstName,
  getRelatedPersonForPatient,
  getSMSNumberForIndividual,
  isPostTelemedAppointment,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, topLevelCatch } from 'zambda-utils';
import { captureSentryException, configSentry, getAuth0Token, sendInPersonMessages } from '../../shared';
import { updateAppointmentTime } from '../../shared/fhir';
import { checkValidBookingTime, createOystehrClient, getParticipantFromAppointment } from '../../shared/helpers';
import { AuditableZambdaEndpoints, createAuditEvent } from '../../shared/userAuditLog';
import { validateRequestParameters } from './validateRequestParameters';

export interface UpdateAppointmentInput {
  appointmentID: string;
  slot: string;
  language: string;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('update-appointment', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    // Step 1: Validate input
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, language, slot, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    let startTime = slot;
    if (!checkValidBookingTime(startTime)) {
      throw APPOINTMENT_CANT_BE_IN_PAST_ERROR;
    }

    startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
    const originalDate = DateTime.fromISO(startTime).setZone('UTC');
    const endTime = originalDate.plus({ minutes: 15 }).toISO();

    console.log('getting appointment and related schedule resource');

    const allResources = (
      await oystehr.fhir.search<Appointment | Location | HealthcareService | Practitioner>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_id',
            value: appointmentID,
          },
          {
            name: '_include',
            value: 'Appointment:actor',
          },
        ],
      })
    ).unbundle();
    console.log(`successfully retrieved ${allResources.length} appointment resources`);

    const fhirAppointment = allResources.find((resource) => resource.resourceType === 'Appointment') as Appointment;

    if (isPostTelemedAppointment(fhirAppointment)) {
      throw POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR;
    }

    console.log(`checking appointment with id ${appointmentID} is not checked in`);
    if (fhirAppointment.status === 'arrived') {
      throw CANT_UPDATE_CHECKED_IN_APT_ERROR;
    } else if (fhirAppointment.status === 'cancelled') {
      throw CANT_UPDATE_CANCELED_APT_ERROR;
    }
    console.log(`checking appointment with id ${appointmentID} is not in the past`);
    const appointmentDateTime = DateTime.fromISO(fhirAppointment?.start ?? '');
    const formattedDate = appointmentDateTime.toISO();
    if (!checkValidBookingTime(formattedDate ?? '')) {
      throw PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR;
    }

    const fhirLocation = allResources.find((resource) => resource.resourceType === 'Location');
    const fhirHS = allResources.find((resource) => resource.resourceType === 'HealthcareService');
    const fhirPractitioner = allResources.find((resource) => resource.resourceType === 'Practitioner'); // todo is this right ?
    let scheduleResource: Location | HealthcareService | Practitioner | undefined;
    if (fhirLocation) {
      scheduleResource = fhirLocation as Location;
    } else if (fhirHS) {
      scheduleResource = fhirHS as HealthcareService;
    } else if (fhirPractitioner) {
      scheduleResource = fhirPractitioner as Practitioner;
    }

    if (!scheduleResource) {
      console.log('scheduleResource is missing');
      throw SCHEDULE_NOT_FOUND_ERROR;
    }

    const { availableSlots } = await getAvailableSlotsForSchedule(oystehr, scheduleResource, DateTime.now());

    if (availableSlots.includes(slot)) {
      console.log('slot is available');
    } else {
      console.log('slot is unavailable', slot);
      const response = {
        message: 'Slot unavailable',
        appointmentID: undefined,
        availableSlots,
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    console.log(`updating appointment with id ${appointmentID}`);
    const updatedAppointment: Appointment = await updateAppointmentTime(
      fhirAppointment,
      startTime,
      endTime ?? '',
      oystehr
    );
    console.log('getting patient');
    const fhirPatient: Patient = await oystehr.fhir.get({
      resourceType: 'Patient',
      id: getParticipantFromAppointment(updatedAppointment, 'Patient'),
    });

    // const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    // const user = await appClient.getMe();
    const relatedPerson = await getRelatedPersonForPatient(fhirPatient.id || '', oystehr);
    if (relatedPerson) {
      const timezone = scheduleResource.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString;
      const smsNumber = getSMSNumberForIndividual(relatedPerson);
      if (smsNumber) {
        await sendInPersonMessages(
          getPatientContactEmail(fhirPatient), // todo use the right email
          getPatientFirstName(fhirPatient),
          `RelatedPerson/${relatedPerson.id}`,
          originalDate.setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
          secrets,
          scheduleResource,
          appointmentID,
          fhirAppointment.appointmentType?.text || '',
          language,
          zapehrToken
        );
      } else {
        console.log(`missing sms number for related person with id ${relatedPerson.id}`);
      }
    } else {
      console.log(`No RelatedPerson found for patient ${fhirPatient.id} not sending text message`);
    }

    const response = {
      message: 'Successfully updated an appointment',
      appointmentID: updatedAppointment.id ?? null,
    };

    await createAuditEvent(AuditableZambdaEndpoints.appointmentUpdate, oystehr, input, fhirPatient.id || '', secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('update-appointment', error, input.secrets, captureSentryException);
  }
});
