import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, HealthcareService, Location, Patient, Practitioner, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_CANT_BE_IN_PAST_ERROR,
  BookableScheduleData,
  CANT_UPDATE_CANCELED_APT_ERROR,
  CANT_UPDATE_CHECKED_IN_APT_ERROR,
  DATETIME_FULL_NO_YEAR,
  PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleType,
  Secrets,
  checkValidBookingTime,
  getAvailableSlotsForSchedules,
  getPatientContactEmail,
  getPatientFirstName,
  getRelatedPersonForPatient,
  getSMSNumberForIndividual,
  isPostTelemedAppointment,
} from 'utils';
import {
  AuditableZambdaEndpoints,
  captureSentryException,
  configSentry,
  createAuditEvent,
  createOystehrClient,
  getAuth0Token,
  getParticipantFromAppointment,
  sendInPersonMessages,
  topLevelCatch,
  updateAppointmentTime,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { getSlugForBookableResource } from '../../bookable/helpers';

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
      await oystehr.fhir.search<Appointment | Location | HealthcareService | Practitioner | Slot | Schedule>({
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
          {
            name: '_include',
            value: 'Appointment:slot',
          },
          {
            name: '_include:iterate',
            value: 'Slot:schedule',
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
    const fhirPractitioner = allResources.find((resource) => resource.resourceType === 'Practitioner');
    const fhirSchedule = allResources.find((resource) => resource.resourceType === 'Schedule') as Schedule | undefined;

    let scheduleOwner: Location | HealthcareService | Practitioner | undefined;
    if (fhirLocation) {
      scheduleOwner = fhirLocation as Location;
    } else if (fhirHS) {
      scheduleOwner = fhirHS as HealthcareService;
    } else if (fhirPractitioner) {
      scheduleOwner = fhirPractitioner as Practitioner;
    }

    if (!scheduleOwner || !fhirSchedule) {
      console.log('scheduleResource is missing');
      throw SCHEDULE_NOT_FOUND_ERROR;
    }
    let scheduleType: ScheduleType;
    if (scheduleOwner.resourceType === 'Location') {
      scheduleType = ScheduleType.location;
    } else if (scheduleOwner.resourceType === 'Practitioner') {
      scheduleType = ScheduleType.provider;
    } else {
      scheduleType = ScheduleType.group;
    }

    const slug = getSlugForBookableResource(scheduleOwner);
    if (!slug) {
      // todo: better error message?
      throw new Error('slug is missing');
    }

    // note: what should be happening here instead is that a Slot resource will be passed in with info about the schedule
    // the rescheduled appointment will be against, rather than trying to infer it from time and original appointment
    // this is an important change to make before merging
    const scheduleData: BookableScheduleData = {
      scheduleList: [
        {
          schedule: fhirSchedule,
          owner: scheduleOwner,
        },
      ],
      owner: scheduleOwner,
      metadata: {
        type: scheduleType,
      },
    };

    const { availableSlots } = await getAvailableSlotsForSchedules({
      now: DateTime.now(),
      scheduleList: scheduleData.scheduleList,
      busySlots: [], // todo: add busy slots or refactor - see previous todo, these can be queried form the passed in slot
    });

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
      const timezone = scheduleOwner.extension?.find(
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
          scheduleOwner,
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
