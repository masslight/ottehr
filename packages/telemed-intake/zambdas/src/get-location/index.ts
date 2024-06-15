import { FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, AppointmentParticipant, Location } from 'fhir/r4';
import {
  createFhirClient,
  getDateTimeFromDateAndTime,
  GetLocationResponse,
  getSecret,
  Secrets,
  SecretsKeys,
  ZambdaInput,
} from 'ottehr-utils';
import { getM2MClientToken } from '../shared';
import { DateTime } from 'luxon';
import { validateRequestParameters } from './validateRequestParameters';

export interface Weekdays {
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

export interface GetLocationInput {
  slug: string;
  secrets: Secrets | null;
}

let zapehrToken: string;
const NUM_DAYS = 7;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
    const validatedParameters = validateRequestParameters(input);
    const { slug } = validatedParameters;

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getM2MClientToken(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const fhirClient = createFhirClient(zapehrToken);

    const location = await getLocation(fhirClient, slug);

    if (!location) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Location is not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(location),
    };
  } catch (error: any) {
    console.error('Failed to get telemed states', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error while fetching location' }),
    };
  }
};

async function getLocation(fhirClient: FhirClient, slug: string): Promise<GetLocationResponse | undefined> {
  const availableLocations = await fhirClient.searchResources({
    resourceType: 'Location',
    searchParams: [
      // { name: 'status', value: 'active' },
      { name: 'identifier', value: slug },
    ],
  });

  if (availableLocations.length === 0) {
    return undefined;
  }

  const location: Location = availableLocations[0] as Location;
  // todo do not assume zone
  const now = DateTime.now().setZone('US/Eastern');

  const { minimum: startTime, maximum: finishTime } = createMinimumAndMaximumTime(now);
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
      { name: 'date', value: `ge${startTime}` },
      { name: 'date', value: `le${finishTime}` },
      { name: '_count', value: '1000' },
    ],
  });

  console.log('Getting slots for', location.id);
  if (!location.id) {
    console.log('location id is not defined', location);
    throw new Error('location id is not defined');
  }

  const scheduleExtension = location?.extension?.find(function (extensionTemp) {
    return extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule';
  })?.valueString;
  if (!scheduleExtension) {
    console.log('location does not have schedule');
    return;
  }

  const scheduleTemp = JSON.parse(scheduleExtension);
  const schedule: Weekdays = scheduleTemp.schedule;
  const scheduleOverrides: Overrides = scheduleTemp.scheduleOverrides;

  // get appointments at location
  const appointmentResourcesInLocation = appointmentResources.filter((appointment) => {
    return appointment.participant.some(
      (participant: AppointmentParticipant) => participant.actor === `Location/${location.id}`,
    );
  });

  let currentDayTemp = now;
  const slots = [];
  const finishDate = DateTime.fromISO(finishTime);
  while (currentDayTemp < finishDate) {
    console.log(currentDayTemp);
    const slotsTemp = getSlotsForDay(currentDayTemp, schedule, scheduleOverrides, appointmentResourcesInLocation);
    slots.push(...slotsTemp);
    currentDayTemp = currentDayTemp.plus({ days: 1 });
  }

  return {
    message: 'Successful reply',
    state: location.address?.state || '',
    name: location.name || 'Unkno wn',
    slug:
      location.identifier?.find((identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/slug')
        ?.value || 'Unknown',
    availableSlots: slots,
    // available: location.status === 'active',
    available: true,
  };
}

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

export function createMinimumAndMaximumTime(date: DateTime, buffer?: number): { minimum: string; maximum: string } {
  const startTime = date.toISO();
  const finishTime = date.plus({ days: NUM_DAYS });
  const maximum = finishTime.endOf('day').toISO();
  return { minimum: startTime, maximum: finishTime };
}

export const distributeTimeSlots = (
  startTime: DateTime,
  capacity: number,
  openingTime: DateTime,
  closingTime: DateTime,
  currentAppointments: Appointment[],
): string[] => {
  // console.log(1, startTime, capacity, openingTime, closingTime);
  const ROUND_MINUTES = 15;

  // const minutesToDistributeInHour = Math.min(
  //   60,
  //   startTime.diff(openingTime, 'minutes').minutes,
  //   startTime.diff(closingTime, 'minutes').minutes
  // );

  // adjust startTime if minutes are not 00 to get an accurate minutesToDistributeInHour
  const adjustedStart: DateTime = startTime.minute !== 0 ? startTime.minus({ minutes: startTime.minute }) : startTime;

  const openingDifference = openingTime.diff(adjustedStart, 'minutes').minutes;
  const closingDifference = closingTime.diff(startTime, 'minutes').minutes;
  let minutesToDistributeInHour = 60;

  if (openingDifference > 0 && openingDifference < 60) {
    minutesToDistributeInHour = 30;
  } else if (closingDifference > 0 && closingDifference < 60) {
    minutesToDistributeInHour = 30;
  }

  const minutesPerSlot = minutesToDistributeInHour / capacity;
  const timeSlots: { [slot: string]: number } = {};
  let tempTime = startTime;
  // console.log(startTime.toISO(), capacity);
  for (let i = 0; i < capacity; i++) {
    let tempUpdatedRoundedMinute = Math.round(tempTime.minute / ROUND_MINUTES) * ROUND_MINUTES;
    // todo check if this is right
    if (tempUpdatedRoundedMinute === 60) {
      tempUpdatedRoundedMinute = 60 - ROUND_MINUTES;
    }
    const tempRoundedTime = tempTime.set({ minute: tempUpdatedRoundedMinute, second: 0, millisecond: 0 });
    tempTime = tempTime.plus({ minutes: minutesPerSlot });
    const timesSlotIndex = tempRoundedTime.toISO() || '';
    // console.log(1, tempRoundedTime.toISO());

    // Appointments are bookable an hour away from the current time
    if (tempRoundedTime < DateTime.now().setZone('UTC').plus({ hours: 1 })) {
      continue;
    }

    // If opening time is 10am the first slot is 10am.
    // If closing time is 7pm the last slot is 6:45pm.
    if (tempRoundedTime < openingTime || tempRoundedTime >= closingTime) {
      continue;
    }

    if (!timeSlots[timesSlotIndex]) {
      timeSlots[timesSlotIndex] = 0;
    }

    timeSlots[timesSlotIndex]++;
  }

  const availableSlots = Object.keys(timeSlots).filter((timeSlot) => {
    const numSlots = timeSlots[timeSlot];
    let numAppointments = 0;
    currentAppointments.forEach((appointmentTemp) => {
      if (appointmentTemp.start && appointmentTemp.start === DateTime.fromISO(timeSlot).setZone('UTC').toISO()) {
        numAppointments++;
      }
    });

    return numSlots > numAppointments;
  });
  // console.log(4, availableSlots);
  return availableSlots;
};
