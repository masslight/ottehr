import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment as FhirAppointment, HealthcareService, Location, Practitioner, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  AvailableLocationInformation,
  GetAppointmentDetailsResponse,
  getAvailableSlotsForSchedules,
  getLocationInformation,
  getSecret,
  SCHEDULE_NOT_FOUND_ERROR,
  Secrets,
  SecretsKeys,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetAppointmentDetailInput {
  appointmentID: string;
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
const ZAMBDA_NAME = 'get-appointment-details';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

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
          {
            name: '_revinclude:iterate',
            value: 'Schedule:actor:Location',
          },
          {
            name: '_revinclude:iterate',
            value: 'Schedule:actor:Practitioner',
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
    let fhirSlot = allResources.find((resource) => resource.resourceType === 'Slot') as Slot;
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
    if (!fhirSchedule) {
      console.log('scheduleResource is missing', fhirAppointment.participant);
      throw SCHEDULE_NOT_FOUND_ERROR;
    }

    // once we're using a slot on the appointment in all cases we can get rid of this
    if (!fhirSlot) {
      let slotEnd: string = fhirAppointment.end ?? '';
      if (!slotEnd) {
        const appointmentDateTime = DateTime.fromISO(fhirAppointment?.start ?? '');
        slotEnd = appointmentDateTime.plus({ minutes: 15 }).toISO() ?? '';
      }
      fhirSlot = {
        resourceType: 'Slot',
        id: `${fhirSchedule.id}-${fhirAppointment.start}`,
        status: 'busy',
        start: fhirAppointment.start!,
        end: slotEnd,
        schedule: {
          reference: `Schedule/${fhirSchedule.id}`,
        },
      };
    }

    const locationInformation: AvailableLocationInformation = getLocationInformation(scheduleOwner, fhirSchedule);

    const appointment: GetAppointmentDetailsResponse['appointment'] = {
      start: fhirAppointment.start || 'Unknown',
      location: locationInformation,
      status: fhirAppointment?.status,
      visitType: fhirAppointment.appointmentType?.text || 'Unknown',
      slot: fhirSlot,
    };

    console.log('current appointment slot: ', fhirSlot);
    // we need to get available slots here, at least for now, because this endpoint is used to populate
    // the slot data in the reschedule page
    // a better solution would probably be to call the existing endpoint to get the slot data (get-schedule)
    // rather than duplicating the logic here
    const { availableSlots } = await getAvailableSlotsForSchedules(
      {
        now: DateTime.now(),
        scheduleList: [{ schedule: fhirSchedule, owner: scheduleOwner }],
      },
      oystehr
    );

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
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-appointment-details', error, ENVIRONMENT, true);
  }
});
