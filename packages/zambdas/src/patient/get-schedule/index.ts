import { APIGatewayProxyResult } from 'aws-lambda';
import { Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AvailableLocationInformation,
  FHIR_RESOURCE_NOT_FOUND,
  fhirTypeForScheduleType,
  getAvailableSlotsForSchedules,
  getLocationInformation,
  getOpeningTime,
  getScheduleExtension,
  GetScheduleResponse,
  getSecret,
  getTimezone,
  getWaitingMinutesAtSchedule,
  isLocationOpen,
  isLocationVirtual,
  SecretsKeys,
  SlotListItem,
  Timezone,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getSchedules,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler('get-schedule', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log('this should get logged out if the zambda has been deployed');
  console.log(`Input: ${JSON.stringify(input)}`);

  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, scheduleType, slug } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token', oystehrToken);
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
    if (!oystehr) {
      throw new Error('error initializing fhir client');
    }

    const telemedAvailable: SlotListItem[] = [];
    const availableSlots: SlotListItem[] = [];

    console.time('get-schedule-from-slug');
    const scheduleData = await getSchedules(oystehr, scheduleType, slug);
    const { scheduleList, metadata, rootScheduleOwner: scheduleOwner } = scheduleData;
    console.timeEnd('get-schedule-from-slug');
    console.log('groupItems retrieved from getScheduleUtil:', JSON.stringify(scheduleList, null, 2));
    //console.log('owner retrieved from getScheduleUtil:', JSON.stringify(scheduleOwner, null, 2));
    console.log('scheduleMetaData', JSON.stringify(metadata, null, 2));

    console.time('synchronous_data_processing');
    const { telemedAvailable: tmSlots, availableSlots: regularSlots } = await getAvailableSlotsForSchedules(
      {
        now: DateTime.now(),
        scheduleList,
      },
      oystehr
    );
    if (scheduleOwner.resourceType === 'Location' && !isLocationVirtual(scheduleOwner as Location)) {
      telemedAvailable.push(...tmSlots);
    }
    availableSlots.push(...regularSlots);
    console.timeEnd('synchronous_data_processing');

    if (!scheduleOwner) {
      throw FHIR_RESOURCE_NOT_FOUND(fhirTypeForScheduleType(scheduleType));
    }

    const now = DateTime.now();

    // todo: this should live on a fhir resource rather than being a global secret
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

    const scheduleMatch = scheduleList.find((scheduleAndOwner) => {
      const { owner } = scheduleAndOwner;
      return owner && `${owner.resourceType}/${owner.id}` === `${scheduleOwner.resourceType}/${scheduleOwner.id}`;
    })?.schedule;

    const locationInformationWithClosures: AvailableLocationInformation = getLocationInformation(
      scheduleOwner,
      scheduleMatch
    );

    console.log('getting wait time based on longest waiting patient at location');
    console.time('get_waiting_minutes');
    const waitingMinutes = await getWaitingMinutesAtSchedule(oystehr, now, scheduleOwner);
    console.timeEnd('get_waiting_minutes');

    let timezone: Timezone | undefined;
    if (scheduleList.length === 1) {
      const schedule = scheduleList[0].schedule;
      if (schedule) {
        timezone = getTimezone(schedule);
      }
    }

    const response: GetScheduleResponse = {
      message: 'Successfully retrieved all available slot times',
      available: availableSlots,
      telemedAvailable,
      location: locationInformationWithClosures,
      displayTomorrowSlotsAtHour: DISPLAY_TOMORROW_SLOTS_AT_HOUR,
      waitingMinutes,
      timezone,
    };

    console.log('response to return: ', response);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-schedule', error, ENVIRONMENT);
  }
});

export function getNextOpeningDateTime(now: DateTime, schedule: Schedule): string | undefined {
  const NUM_DAYS_TO_CHECK = 30;
  let day = 0;
  let nextOpeningTime: DateTime | undefined;
  const scheduleExtension = getScheduleExtension(schedule);
  if (!scheduleExtension) {
    return undefined;
  }
  const timezone = getTimezone(schedule);
  while (day < NUM_DAYS_TO_CHECK && nextOpeningTime === undefined) {
    const nextOpeningDate = now.plus({ day });
    if (isLocationOpen(scheduleExtension, timezone, nextOpeningDate)) {
      const maybeNextOpeningTime = getOpeningTime(scheduleExtension, timezone, nextOpeningDate);
      if (maybeNextOpeningTime && maybeNextOpeningTime > now) {
        nextOpeningTime = maybeNextOpeningTime;
      }
    }
    day++;
  }
  return nextOpeningTime?.setZone('utc').toFormat('HH:mm MM-dd-yyyy z');
}
