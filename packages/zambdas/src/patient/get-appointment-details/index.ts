import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment as FhirAppointment, HealthcareService, Location, Practitioner, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  AvailableLocationInformation,
  SCHEDULE_NOT_FOUND_ERROR,
  Secrets,
  SecretsKeys,
  getAvailableSlotsForSchedules,
  getSecret,
} from 'utils';
import { topLevelCatch, ZambdaInput } from '../../shared';
import '../../shared/instrument.mjs';
import {
  captureSentryException,
  configSentry,
  createOystehrClient,
  getAuth0Token,
  getLocationInformation,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetAppointmentDetailInput {
  appointmentID: string;
  secrets: Secrets | null;
}

interface Appointment {
  start: string;
  location: AvailableLocationInformation;
  visitType: string;
  status?: string;
}

interface GetAppointmentDetailsResponse {
  appointment: {
    start: string;
    location: AvailableLocationInformation;
    visitType: string;
    status?: string;
  };
  availableSlots: string[];
  displayTomorrowSlotsAtHour: number;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('get-appointment-details', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    const DISPLAY_TOMORROW_SLOTS_AT_HOUR = parseInt(
      getSecret(SecretsKeys.IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR, secrets)
    );

    console.log('getting all appointment resources');
    const allResources = (
      await oystehr.fhir.search<FhirAppointment | Slot | Schedule | Location | HealthcareService | Practitioner>({
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
    const fhirAppointment = allResources.find((resource) => resource.resourceType === 'Appointment') as FhirAppointment;
    const fhirLocation = allResources.find((resource) => resource.resourceType === 'Location');
    const fhirHS = allResources.find((resource) => resource.resourceType === 'HealthcareService');
    const fhirPractitioner = allResources.find((resource) => resource.resourceType === 'Practitioner');
    // todo: use the slot to get the schedule owner and get rid of all this other stuff
    const fhirSlot = allResources.find((resource) => resource.resourceType === 'Slot') as Slot;
    const fhirSchedule = allResources.find((resource) => resource.resourceType === 'Schedule') as Schedule;

    let scheduleOwner: Location | HealthcareService | Practitioner | undefined;
    if (fhirLocation) {
      scheduleOwner = fhirLocation as Location;
    } else if (fhirHS) {
      scheduleOwner = fhirHS as HealthcareService;
    } else if (fhirPractitioner) {
      scheduleOwner = fhirPractitioner as Practitioner;
    }

    if (!fhirAppointment) {
      throw APPOINTMENT_NOT_FOUND_ERROR;
    }

    if (!scheduleOwner) {
      console.log('scheduleResource is missing');
      throw SCHEDULE_NOT_FOUND_ERROR;
    }

    const locationInformation: AvailableLocationInformation = getLocationInformation(oystehr, scheduleOwner);

    const appointment: Appointment = {
      start: fhirAppointment.start || 'Unknown',
      location: locationInformation,
      status: fhirAppointment?.status,
      visitType: fhirAppointment.appointmentType?.text || 'Unknown',
    };

    console.log('current appointment slot: ', fhirSlot);
    // todo: consider whether we really need to be getting avaialble slots when getting appointment details
    // why do we need to do this?
    const { availableSlots } = await getAvailableSlotsForSchedules({
      now: DateTime.now(),
      scheduleList: [{ schedule: fhirSchedule, owner: scheduleOwner }],
      busySlots: [],
    });

    const response: GetAppointmentDetailsResponse = {
      appointment,
      availableSlots,
      displayTomorrowSlotsAtHour: DISPLAY_TOMORROW_SLOTS_AT_HOUR,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('get-appointment-details', error, input.secrets, captureSentryException);
  }
});
