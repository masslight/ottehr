import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { createFhirClient } from '../shared/helpers';
import { Address, Appointment, ContactPoint, Location, LocationHoursOfOperation } from 'fhir/r4';
import {
  getDateTimeFromDateAndTime,
  createMinimumAndMaximumTime,
  getAvailableSlots,
  distributeTimeSlots,
} from '../shared/dateUtils';
import { DateTime } from 'luxon';
import { SearchParam } from '@zapehr/sdk';
import { Secrets, ZambdaInput, topLevelCatch } from 'utils';
import { getAccessToken } from '../shared';

export interface AvailableLocationInformation {
  id: string | undefined;
  slug: string | undefined;
  name: string | undefined;
  description: string | undefined;
  address: Address | undefined;
  telecom: ContactPoint[] | undefined;
  hoursOfOperation: LocationHoursOfOperation[] | undefined;
  timezone: string | undefined;
}

export interface GetSlotsAvailabilityInput {
  locationSlug: string;
  secrets: Secrets | null;
}

interface Weekdays {
  [day: string]: Weekday;
}

export interface Overrides {
  [day: string]: Day;
}

interface Weekday extends Day {
  workingDay: boolean;
}

export interface Day {
  open: number;
  close: number;
  openingBuffer: number;
  closingBuffer: number;
  hours: Capacity[];
}

export interface Capacity {
  hour: number;
  capacity: number;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, locationSlug } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);
    // get specific location resource with all the slots

    const searchParams: SearchParam[] = [{ name: 'status', value: 'active' }];
    if (locationSlug) {
      searchParams.push({ name: 'identifier', value: locationSlug });
    }

    console.log('getting location');
    const availableLocations: Location[] = await fhirClient?.searchResources({
      resourceType: 'Location',
      searchParams: searchParams,
    });

    if (availableLocations.length === 0) {
      throw new Error('location name is not found');
    }

    const location = availableLocations[0];

    if (!location.id) {
      throw new Error('location id is not defined');
    }
    console.log(`successfully retrieved location with id ${location.id}`);
    const timezone = location.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
    )?.valueString;

    if (!timezone) {
      throw new Error('location does not have timezone');
    }
    const now = DateTime.now().setZone(timezone);

    const longestWaitingPatientAtLocationSearchParams = [
      { name: 'location', value: `Location/${location.id}` },
      { name: 'status', value: 'arrived' },
      { name: 'date', value: `le${now.toISO()}` },
      { name: '_sort', value: 'date' },
      { name: '_count', value: '1' },
    ];
    console.log('getting longest waiting patient at location');
    const longestWaitingPatientAtLocation: Appointment[] = await fhirClient.searchResources({
      resourceType: 'Appointment',
      searchParams: longestWaitingPatientAtLocationSearchParams,
    });

    let waitingMinutes;
    if (!longestWaitingPatientAtLocation || longestWaitingPatientAtLocation.length === 0) {
      console.log('set waiting time to 15 minutes');
      waitingMinutes = 15;
    } else {
      console.log('set waiting time based on longest waiting time');
      waitingMinutes =
        15 +
        (now.diff(DateTime.fromISO(longestWaitingPatientAtLocation?.[0]?.start || ''), ['minutes']).toObject()
          .minutes || 0);
    }

    console.log('build location information');
    const locationInformation: AvailableLocationInformation = {
      id: location.id,
      slug: location.identifier?.find(
        (identifierTemp) => identifierTemp.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/location',
      )?.value,
      name: location.name,
      description: location.description,
      address: location.address,
      telecom: location.telecom,
      hoursOfOperation: location.hoursOfOperation,
      timezone: timezone,
    };

    // get iso date string for today and end of tomorrow
    const { minimum: today, maximum: tomorrow } = createMinimumAndMaximumTime(now);

    // search for appointment resources using the specific location and get all appointments starting today and end of tomorrow
    console.log(`searching for appointments based on location ${location.id} and date`);
    const appointmentResources: Appointment[] = await fhirClient?.searchResources({
      resourceType: 'Appointment',
      searchParams: [
        {
          name: 'location',
          value: `Location/${location.id}`,
        },
        {
          name: 'status:not',
          value: 'cancelled',
        },
        { name: 'date', value: `ge${today}` },
        { name: 'date', value: `le${tomorrow}` },
        { name: '_count', value: '1000' },
      ],
    });

    const scheduleExtension = location?.extension?.find(function (extensionTemp) {
      return extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule';
    })?.valueString;
    console.log(scheduleExtension);
    if (!scheduleExtension) {
      throw new Error('location does not have schedule');
    }

    const scheduleTemp = JSON.parse(scheduleExtension);
    const schedule: Weekdays = scheduleTemp.schedule;
    const scheduleOverrides: Overrides = scheduleTemp.scheduleOverrides;

    console.log("getting today's slots");
    const todaySlots = getSlotsForDay(now, schedule, scheduleOverrides, appointmentResources);
    console.log("getting tomorrows's slots");
    const tomorrowSlots = getSlotsForDay(now.plus({ day: 1 }), schedule, scheduleOverrides, appointmentResources);

    const slots = [...todaySlots, ...tomorrowSlots];
    console.log('getting available slots');
    const availableSlots = getAvailableSlots(slots, timezone);

    const response = {
      message: 'Successfully retrieved all available slot times',
      available: availableSlots,
      location: locationInformation,
      waitingMinutes,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('get-location', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

function getSlotsForDay(
  day: DateTime,
  schedule: Weekdays,
  scheduleOverrides: Overrides,
  appointments: Appointment[],
): string[] {
  let openingTime = null;
  let closingTime = null;
  let openingBuffer = null;
  let closingBuffer = null;
  let timeSlots = null;
  let dayString: string = day.toLocaleString(DateTime.DATE_SHORT);
  const scheduleOverridden = Object.keys(scheduleOverrides).find((overrideTemp) => overrideTemp === dayString);
  console.log(Object.keys(scheduleOverrides), day.toLocaleString(DateTime.DATE_SHORT));

  let scheduleTemp = scheduleOverrides;
  if (!scheduleOverridden && day.weekdayLong) {
    dayString = day.weekdayLong.toLowerCase();
    scheduleTemp = schedule;

    if (!schedule[dayString].workingDay) {
      return [];
    }
  }

  openingTime = scheduleTemp[dayString].open;
  closingTime = scheduleTemp[dayString].close === 0 && openingTime !== 0 ? 24 : scheduleTemp[dayString].close;
  openingBuffer = scheduleTemp[dayString].openingBuffer;
  closingBuffer = scheduleTemp[dayString].closingBuffer;
  timeSlots = scheduleTemp[dayString].hours;

  const slots: string[] = [];
  let openingDateAndTime: DateTime | undefined = undefined;
  let closingDateAndTime: DateTime | undefined = undefined;

  if (openingTime !== undefined) {
    openingDateAndTime = getDateTimeFromDateAndTime(day, openingTime);
    openingDateAndTime = openingDateAndTime.plus({ minutes: openingBuffer });
  }
  if (closingTime !== undefined) {
    closingDateAndTime = getDateTimeFromDateAndTime(day, closingTime);
    closingDateAndTime = closingDateAndTime.minus({ minutes: closingBuffer });
  }

  timeSlots?.forEach((slot) => {
    if (!openingDateAndTime || !closingDateAndTime) {
      console.log('error getting available time slots', openingDateAndTime, closingDateAndTime);
      throw Error('error getting available time slots');
    }
    let tempDateTime = getDateTimeFromDateAndTime(day, slot.hour);
    if (tempDateTime.hour === openingDateAndTime.hour) {
      tempDateTime = tempDateTime.set({ minute: openingDateAndTime.minute });
    }
    slots.push(
      ...distributeTimeSlots(tempDateTime, slot.capacity, openingDateAndTime, closingDateAndTime, appointments),
    );
  });

  return slots;
}
