import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment as FhirAppointment, FhirResource, HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  AvailableLocationInformation,
  SCHEDULE_NOT_FOUND_ERROR,
  getAvailableSlotsForSchedule,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, SecretsKeys, getSecret, topLevelCatch } from 'zambda-utils';
import '../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../shared';
import { createOystehrClient, getLocationInformation } from '../shared/helpers';
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
      await oystehr.fhir.search<FhirResource>({
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
    const fhirAppointment = allResources.find((resource) => resource.resourceType === 'Appointment') as FhirAppointment;
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

    if (!fhirAppointment) {
      throw APPOINTMENT_NOT_FOUND_ERROR;
    }

    if (!scheduleResource) {
      console.log('scheduleResource is missing');
      throw SCHEDULE_NOT_FOUND_ERROR;
    }

    const locationInformation: AvailableLocationInformation = getLocationInformation(oystehr, scheduleResource);

    const appointment: Appointment = {
      start: fhirAppointment.start || 'Unknown',
      location: locationInformation,
      status: fhirAppointment?.status,
      visitType: fhirAppointment.appointmentType?.text || 'Unknown',
    };

    const { availableSlots } = await getAvailableSlotsForSchedule(oystehr, scheduleResource, DateTime.now());

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
