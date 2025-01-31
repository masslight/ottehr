import Oystehr from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AvailableLocationInformation,
  GetScheduleResponse,
  getAvailableSlotsForSchedule,
  getOpeningTime,
  getScheduleDetails,
  getWaitingMinutesAtSchedule,
  isLocationOpen,
  isWalkinOpen,
  makeSlotTentativelyBusy,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { SecretsKeys, getSecret, topLevelCatch } from 'zambda-utils';
import '../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../shared';
import { getSchedule } from '../shared/fhir';
import { createOystehrClient, getLocationInformation } from '../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('get-schedule', input.secrets);
  console.log('this should get logged out if the zambda has been deployed');
  console.log(`Input: ${JSON.stringify(input)}`);

  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, scheduleType, slug, specificSlot } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token', zapehrToken);
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);
    if (!oystehr) {
      throw new Error('error initializing fhir client');
    }

    console.time('get-schedule-from-slug');
    const { schedule, groupItems } = await getSchedule(oystehr, scheduleType, slug);
    console.timeEnd('get-schedule-from-slug');
    const now = DateTime.now();

    const DISPLAY_TOMORROW_SLOTS_AT_HOUR = parseInt(
      getSecret(SecretsKeys.IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR, secrets)
    );

    /*
    todo when Zap supports the near param
    const nearbyLocations: Location = [];

    const latitude = location.position?.latitude;
    const longitude = location.position?.longitude;
    if (latitude && longitude && location.id) {
      console.log('searching for locations near', latitude, longitude);
      const nearbyLocationSearchResults: Location[] = await oystehr.searchResources({
        resourceType: 'Location',
        searchParams: [
          { name: 'near', value: `${latitude}|${longitude}|20.0|mi_us` },
          // { name: '_id:not-in', value: location.id },
        ],
      });
      console.log('nearbyLocationSearchResults', nearbyLocationSearchResults.length);
    }*/

    console.log('organizing location information for response');
    const locationInformationWithClosures: AvailableLocationInformation = getLocationInformationWithClosures(
      oystehr,
      schedule,
      now
    );

    console.log('getting wait time based on longest waiting patient at location');
    console.time('get_waiting_minutes');
    const waitingMinutes = await getWaitingMinutesAtSchedule(oystehr, now, schedule);
    console.timeEnd('get_waiting_minutes');
    console.time('synchronous_data_processing');
    const { telemedAvailable, availableSlots } = await getAvailableSlotsForSchedule(
      oystehr,
      schedule,
      DateTime.now(),
      groupItems
    );
    console.timeEnd('synchronous_data_processing');

    if (specificSlot) {
      if (availableSlots.includes(specificSlot)) {
        console.log('making the selected slot unavailable');
        console.time('mark_slot_busy');
        const specificSlotResource = await makeSlotTentativelyBusy(specificSlot, schedule, oystehr);
        console.timeEnd('mark_slot_busy');
        console.log('tentatively busy slot: ', specificSlotResource?.id);
      } else {
        console.log('selected slot is not available');
      }
    }

    const walkinOpen = isWalkinOpen(locationInformationWithClosures, now);
    const openTime = walkinOpen ? undefined : getNextOpeningDateTime(oystehr, now, schedule);

    const response: GetScheduleResponse = {
      message: 'Successfully retrieved all available slot times',
      available: availableSlots,
      telemedAvailable,
      location: locationInformationWithClosures,
      displayTomorrowSlotsAtHour: DISPLAY_TOMORROW_SLOTS_AT_HOUR,
      waitingMinutes,
      walkinOpen,
      openTime,
    };

    console.log('response to return: ', response);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('get-schedule', error, input.secrets, captureSentryException);
  }
});

export function getNextOpeningDateTime(
  oystehr: Oystehr,
  now: DateTime,
  schedule: Location | Practitioner | HealthcareService
): string | undefined {
  const NUM_DAYS_TO_CHECK = 30;
  let day = 0;
  let nextOpeningTime: DateTime | undefined;
  while (day < NUM_DAYS_TO_CHECK && nextOpeningTime === undefined) {
    const nextOpeningDate = now.plus({ day });
    const locationInfo = getLocationInformation(oystehr, schedule, nextOpeningDate);
    if (isLocationOpen(locationInfo, nextOpeningDate)) {
      const maybeNextOpeningTime = getOpeningTime(locationInfo, nextOpeningDate);
      if (maybeNextOpeningTime && maybeNextOpeningTime > now) {
        nextOpeningTime = maybeNextOpeningTime;
      }
    }
    day++;
  }
  return nextOpeningTime?.setZone('utc').toFormat('HH:mm MM-dd-yyyy z');
}

function getLocationInformationWithClosures(
  oystehr: Oystehr,
  scheduleResource: Location | Practitioner | HealthcareService,
  currentDate: DateTime
): AvailableLocationInformation {
  const scheduleInformation: AvailableLocationInformation = getLocationInformation(
    oystehr,
    scheduleResource,
    currentDate
  );
  const schedule = getScheduleDetails(scheduleResource);
  const scheduleInformationWithClosures: AvailableLocationInformation = {
    ...scheduleInformation,
    closures: schedule?.closures ?? [],
  };
  return scheduleInformationWithClosures;
}
