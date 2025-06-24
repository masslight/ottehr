import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, HealthcareService, Location, Patient, Practitioner, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_CANT_BE_IN_PAST_ERROR,
  BookableScheduleData,
  CANT_UPDATE_CANCELED_APT_ERROR,
  CANT_UPDATE_CHECKED_IN_APT_ERROR,
  checkValidBookingTime,
  DATETIME_FULL_NO_YEAR,
  getAvailableSlotsForSchedules,
  getPatientContactEmail,
  getPatientFirstName,
  getRelatedPersonForPatient,
  getSecret,
  getSMSNumberForIndividual,
  isAppointmentVirtual,
  isPostTelemedAppointment,
  isValidUUID,
  normalizeSlotToUTC,
  PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleType,
  Secrets,
  SecretsKeys,
  UpdateAppointmentParameters,
} from 'utils';
import {
  AuditableZambdaEndpoints,
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

export interface UpdateAppointmentInput extends UpdateAppointmentParameters {
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
    const { appointmentID, language, slot: inputSlot, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    const slot = normalizeSlotToUTC(inputSlot);

    const startTime = slot.start;
    const endTime = slot.end;
    if (!checkValidBookingTime(startTime)) {
      throw APPOINTMENT_CANT_BE_IN_PAST_ERROR;
    }
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
    // https://github.com/masslight/ottehr/issues/2431
    // todo: remove the second condition once virtual prebook appointments begin in 'booked' status
    if (fhirAppointment.status === 'arrived' && !isAppointmentVirtual(fhirAppointment)) {
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

    const scheduleData: BookableScheduleData = {
      scheduleList: [
        {
          schedule: fhirSchedule,
          owner: scheduleOwner,
        },
      ],
      metadata: {
        type: scheduleType,
      },
    };

    const { availableSlots } = await getAvailableSlotsForSchedules(
      {
        now: DateTime.now(),
        scheduleList: scheduleData.scheduleList,
      },
      oystehr
    );

    // todo: make reschedule behave more like create appointment in terms of available slots
    const slotAlreadyPersisted = isValidUUID(slot.id ?? '');
    if (slotAlreadyPersisted || availableSlots.map((si) => normalizeSlotToUTC(si.slot).start).includes(slot.start)) {
      console.log('slot is available');
    } else {
      console.log('slot start', slot.start, availableSlots[0].slot.start);
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
      endTime,
      oystehr,
      slot
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
      console.log(`RelatedPerson found for patient: RP/${relatedPerson.id}`);
      const timezone = scheduleOwner.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString;
      const smsNumber = getSMSNumberForIndividual(relatedPerson);
      if (smsNumber) {
        await sendInPersonMessages(
          getPatientContactEmail(fhirPatient), // todo use the right email
          getPatientFirstName(fhirPatient),
          `RelatedPerson/${relatedPerson.id}`,
          DateTime.fromISO(startTime).setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
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
      appointmentID: updatedAppointment.id,
    };

    await createAuditEvent(AuditableZambdaEndpoints.appointmentUpdate, oystehr, input, fhirPatient.id || '', secrets);

    // todo 1.10: define an output type for this, as it's actually a very tricky type that is differently shaped
    // depending on whether the slot was unavailable or not
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('update-appointment', error, ENVIRONMENT, true);
  }
});
