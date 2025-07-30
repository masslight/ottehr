import Oystehr, { BatchInputDeleteRequest, BatchInputRequest } from '@oystehr/sdk';
import {
  Appointment,
  Encounter,
  FhirResource,
  HealthcareService,
  Location,
  LocationHoursOfOperation,
  Practitioner,
  Schedule,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BookableScheduleData,
  codingContainedInList,
  DEFAULT_APPOINTMENT_LENGTH_MINUTES,
  getFullName,
  getPatchOperationForNewMetaTag,
  isLocationVirtual,
  makeBookingOriginExtensionEntry,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NUM_DAYS,
  ScheduleStrategy,
  scheduleStrategyForHealthcareService,
  SLOT_BOOKING_FLOW_ORIGIN_EXTENSION_URL,
  SLOT_BUSY_TENTATIVE_EXPIRATION_MINUTES,
  SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotServiceCategory,
  TIMEZONE_EXTENSION_URL,
  WALKIN_APPOINTMENT_TYPE_CODE,
} from '../fhir';
import {
  Closure,
  ClosureType,
  CreateSlotParams,
  OVERRIDE_DATE_FORMAT,
  ScheduleOwnerFhirResource,
  ScheduleType,
  ServiceMode,
  Timezone,
  TIMEZONES,
  VisitType,
} from '../types';
import { getDateTimeFromDateAndTime } from './date';
import { convertCapacityListToBucketedTimeSlots, createMinimumAndMaximumTime, distributeTimeSlots } from './dateUtils';

export interface WaitTimeRange {
  low: number;
  high: number;
}

export type DOW = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type HourOfDay =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;

export interface Capacity {
  hour: HourOfDay;
  capacity: number;
}

export interface ScheduleDay {
  open: HourOfDay;
  close: HourOfDay | 24;
  openingBuffer: number;
  closingBuffer: number;
  workingDay: boolean;
  hours: Capacity[];
}

export interface ScheduleOverrideDay {
  open: HourOfDay;
  close: HourOfDay | 24;
  openingBuffer: number;
  closingBuffer: number;
  hours: Capacity[];
}

export type DailySchedule = Record<DOW, ScheduleDay>;
export type ScheduleOverrides = Record<string, ScheduleOverrideDay>;

export interface ScheduleExtension {
  schedule: DailySchedule;
  scheduleOverrides: ScheduleOverrides;
  closures: Closure[] | undefined;
  slotLength?: number;
}

export interface ScheduleDTOOwner {
  type: FhirResource['resourceType'];
  id: string;
  name: string;
  slug: string;
  active: boolean;
  detailText?: string; // to take place of Location.address.line[0]
  infoMessage?: string;
  hoursOfOperation?: Location['hoursOfOperation'];
  timezone: Timezone;
  isVirtual?: boolean;
}
export interface ScheduleDTO {
  id: string;
  owner: ScheduleDTOOwner;
  timezone: Timezone;
  schema: ScheduleExtension;
  bookingLink?: string;
  active: boolean;
}

export type SlotCapacityMap = { [slot: string]: number };

export interface SlotOwner {
  resourceType: string;
  id: string;
  name: string;
}

export interface SlotListItem {
  slot: Slot;
  owner: SlotOwner;
  timezone: Timezone;
}

export const mapSlotListItemToStartTimesArray = (items: SlotListItem[]): string[] => {
  return items.map((item) => {
    if (!item.slot.start) {
      console.error('Slot does not have start time', item);
      throw new Error('All slots must have a start time');
    }
    return item.slot.start;
  });
};

export async function getWaitingMinutesAtSchedule(
  oystehr: Oystehr,
  now: DateTime,
  schedule: Location | Practitioner | HealthcareService
): Promise<number> {
  const timezone = getTimezone(schedule);
  const nowForTimezone = now.setZone(timezone);
  const longestWaitingPatientAtLocationSearchParams = [
    { name: 'status', value: 'arrived' },
    { name: '_include', value: 'Encounter:appointment' },
    { name: 'appointment.date', value: `ge${nowForTimezone.startOf('day').toISO()}` },
    { name: '_sort', value: 'date' },
  ];
  if (schedule.resourceType === 'Location') {
    longestWaitingPatientAtLocationSearchParams.push({ name: 'location', value: `Location/${schedule.id}` });
  }
  if (schedule.resourceType === 'Practitioner') {
    longestWaitingPatientAtLocationSearchParams.push({ name: 'practitioner', value: `Practitioner/${schedule.id}` });
  }
  console.log('searching for longest waiting patient');
  console.time('get_longest_waiting_patient');
  const searchForLongestWaitingPatient = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: longestWaitingPatientAtLocationSearchParams,
    })
  ).unbundle();
  console.timeEnd('get_longest_waiting_patient');

  const arrivedEncounters = searchForLongestWaitingPatient.filter((resource) => resource.resourceType === 'Encounter');

  return getWaitingMinutes(nowForTimezone, arrivedEncounters);
}

const getEncounterArrivedStart = (encounter: Encounter): DateTime | undefined => {
  const arrivedStatus = encounter.statusHistory?.find((h) => h.status === 'arrived');
  if (arrivedStatus?.period.start) return DateTime.fromISO(arrivedStatus?.period.start);
  return;
};

export function getWaitingMinutes(now: DateTime, encounters: Encounter[]): number {
  console.log('reducing encounter search to find longest wait time');
  const longestWait = encounters.reduce((longestWaitAcc: DateTime | undefined, encounter) => {
    const curEncounterStart = getEncounterArrivedStart(encounter);
    if (longestWaitAcc && curEncounterStart) {
      if (curEncounterStart.diff(longestWaitAcc).as('minutes') < 0) {
        longestWaitAcc = curEncounterStart;
      }
    } else if (curEncounterStart) {
      longestWaitAcc = curEncounterStart;
    }
    return longestWaitAcc;
  }, undefined);

  if (!longestWait) {
    console.log('could not find an appointment for the longest waiting patient based on search params');
    console.log('set waiting time to 0 minutes');
    return 0;
  }

  console.log('set waiting time based on longest waiting time');
  console.log('longestWait', longestWait);
  const waitingMinutes = Math.round(now.diff(longestWait).as('minutes') || 0);

  return waitingMinutes;
}

export function getScheduleExtension(
  scheduleResource: Location | Practitioner | HealthcareService | Schedule
): ScheduleExtension | undefined {
  console.log(
    `extracting schedule and possible overrides from extension on ${scheduleResource.resourceType}`,
    scheduleResource.id
  );
  const scheduleExtension = scheduleResource?.extension?.find(function (extensionTemp) {
    return extensionTemp.url === SCHEDULE_EXTENSION_URL;
  })?.valueString;

  if (!scheduleExtension) return undefined;

  const { schedule, scheduleOverrides, closures, slotLength } = JSON.parse(scheduleExtension) as ScheduleExtension;
  return { schedule, scheduleOverrides, closures, slotLength };
}

export function getTimezone(
  schedule: Pick<Location | Practitioner | HealthcareService | Schedule, 'extension' | 'resourceType' | 'id'>
): Timezone {
  const timezone = schedule.extension?.find((extensionTemp) => extensionTemp.url === TIMEZONE_EXTENSION_URL)
    ?.valueString;
  if (!timezone) {
    console.error('Schedule does not have timezone; returning default', schedule.resourceType, schedule.id);
    return TIMEZONES[0];
  }
  return timezone;
}

// creates a map where each open hour in the day's schedule is a key and the capacity for that hour is the value
export function getSlotCapacityMapForDayAndSchedule(
  now: DateTime,
  schedule: DailySchedule,
  scheduleOverrides: ScheduleOverrides,
  closures: Closure[] | undefined,
  slotLength?: number
): SlotCapacityMap {
  let openingTime: HourOfDay | null = null;
  let closingTime: HourOfDay | 24 | null = null;
  let scheduleCapacityList: Capacity[] = [];
  let dayString = now.toFormat(OVERRIDE_DATE_FORMAT);

  //console.log('day:', dayString, 'closures:', closures);
  if (closures) {
    for (const closure of closures) {
      if (closure.type === ClosureType.OneDay && closure.start === dayString) {
        //console.log('closing day', dayString);
        return {};
      } else if (closure.type === ClosureType.Period) {
        const startClosure = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT).startOf('day');
        const endClosure = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT).endOf('day');
        if (now >= startClosure && now <= endClosure) {
          //console.log('closing day', dayString);
          return {};
        }
      }
    }
  }

  const scheduleOverridden = Object.keys(scheduleOverrides).find((overrideTemp) => overrideTemp === dayString);
  //console.log('day:', dayString, 'overrides:', Object.keys(scheduleOverrides));

  let scheduleTemp = scheduleOverrides;
  if (!scheduleOverridden) {
    dayString = now.weekdayLong?.toLowerCase() || '';
    scheduleTemp = schedule;

    if (!schedule[dayString as DOW].workingDay) {
      return {};
    }
  }

  openingTime = scheduleTemp[dayString].open;
  closingTime = scheduleTemp[dayString].close === 0 && openingTime !== 0 ? 24 : scheduleTemp[dayString].close;
  const openingBuffer = scheduleTemp[dayString].openingBuffer;
  const closingBuffer = scheduleTemp[dayString].closingBuffer;
  scheduleCapacityList = scheduleTemp[dayString].hours;

  let openingDateAndTime: DateTime;
  let closingDateAndTime: DateTime;

  if (openingTime !== undefined) {
    openingDateAndTime = getDateTimeFromDateAndTime(now, openingTime);
  } else {
    console.log('location missing opening time');
    throw Error('error getting available time slots, location has no opening time');
  }
  if (closingTime !== undefined) {
    closingDateAndTime = getDateTimeFromDateAndTime(now, closingTime);
  } else {
    console.log('location missing closing time');
    throw Error('error getting available time slots, location has no opening time');
  }
  let timeSlots: SlotCapacityMap = {};
  //console.log('schedule capacity list', scheduleCapacityList);

  timeSlots = convertCapacityListToBucketedTimeSlots(scheduleCapacityList, now, slotLength);

  const buffered = applyBuffersToSlots({
    slots: timeSlots,
    openingBufferMinutes: openingBuffer,
    closingBufferMinutes: closingBuffer,
    openingTime: openingDateAndTime,
    closingTime: closingDateAndTime,
    now,
  });

  return buffered;
}

interface RemoveBusySlotsInput {
  slotCapacityMap: SlotCapacityMap;
  busySlots: Slot[];
  // buffer? leaving this out for now as it's not clear it's needed
}

export const removeBusySlots = (input: RemoveBusySlotsInput): string[] => {
  const { slotCapacityMap: timeSlots, busySlots } = input;
  return distributeTimeSlots(timeSlots, [], busySlots);
};

export function getPostTelemedSlots(now: DateTime, scheduleResource: Schedule, appointments: Appointment[]): string[] {
  const { schedule } = getScheduleExtension(scheduleResource) || { schedule: undefined };
  const timezone = getTimezone(scheduleResource);
  const nowForTimezone = now.setZone(timezone);

  console.log('getting telemed slots for today');
  const todaySlots = getSlotsForDayPostTelemed(nowForTimezone, schedule, appointments);
  console.log('getting telemed slots for tomorrow');
  const tomorrowSlots = getSlotsForDayPostTelemed(
    nowForTimezone.plus({ day: 1 }).startOf('day'),
    schedule,
    appointments
  );
  return [...todaySlots, ...tomorrowSlots];
}

function getSlotsForDayPostTelemed(
  day: DateTime,
  schedule: DailySchedule | undefined,
  appointments: Appointment[]
): string[] {
  if (!schedule) {
    return [];
  }
  const dayString = day.weekdayLong?.toLowerCase() as DOW;
  const openingTime = schedule[dayString].open;
  const openingDateAndTime = getDateTimeFromDateAndTime(day, openingTime);
  const closingTime = schedule[dayString].close === 0 && openingTime !== 0 ? 24 : schedule[dayString].close;
  const closingDateAndTime = getDateTimeFromDateAndTime(day, closingTime);
  const timeToStartSlots =
    day > openingDateAndTime
      ? day.set({ minute: Math.ceil(day.minute / 30) * 30 }).startOf('minute')
      : openingDateAndTime;
  const timeSlots: { [slot: string]: number } = {};
  for (let temp = timeToStartSlots; temp < closingDateAndTime; temp = temp.plus({ minutes: 30 })) {
    const tempTime = temp.toISO() || '';
    timeSlots[tempTime] = 1;
  }

  return distributeTimeSlots(timeSlots, appointments, []);
}

interface GetSlotCapacityMapInput {
  now: DateTime;
  finishDate: DateTime;
  scheduleExtension: ScheduleExtension;
  timezone: string;
  log?: boolean;
}
// returns all slots given current time, schedule, and timezone, irrespective of booked/busy status of any of those slots
export const getAllSlotsAsCapacityMap = (input: GetSlotCapacityMapInput): SlotCapacityMap => {
  const { now, finishDate, scheduleExtension, timezone } = input;
  const { schedule, scheduleOverrides, closures, slotLength } = scheduleExtension;
  const nowForTimezone = DateTime.fromFormat(now.setZone(timezone).toFormat('MM/dd/yyyy'), 'MM/dd/yyyy', {
    zone: timezone,
  }).startOf('day');
  const finishDateForTimezone = DateTime.fromFormat(finishDate.setZone(timezone).toFormat('MM/dd/yyyy'), 'MM/dd/yyyy', {
    zone: timezone,
  });

  /*
  const nowForTimezone = DateTime.fromFormat(now.toFormat('MM/dd/yyyy'), 'MM/dd/yyyy', { zone: timezone }).startOf(
    'day'
  );
  const finishDateForTimezone = DateTime.fromFormat(finishDate.toFormat('MM/dd/yyyy'), 'MM/dd/yyyy', {
    zone: timezone,
  });
  */
  console.log('now for capacity map', nowForTimezone.toISO(), now.toISO());
  let currentDayTemp = nowForTimezone;
  let slots = {};
  while (currentDayTemp < finishDateForTimezone) {
    const slotsTemp = getSlotCapacityMapForDayAndSchedule(
      currentDayTemp,
      schedule,
      scheduleOverrides,
      closures,
      slotLength
    );
    slots = { ...slots, ...slotsTemp };
    currentDayTemp = currentDayTemp.plus({ days: 1 }).startOf('day');
  }

  if (input.log) {
    console.log('all slots', JSON.stringify(slots, null, 2));
  }

  return Object.fromEntries(
    // normalize the timezone of the keys
    Object.entries(slots).map(([key, value]) => {
      return [DateTime.fromISO(key).setZone(timezone).toISO()!, value];
    })
  ) as SlotCapacityMap;
};

export interface GetAvailableSlotsInput {
  now: DateTime;
  numDays: number;
  schedule: Schedule;
  busySlots: Slot[]; // todo 1.8: add these in upstream
}

// returns a list of available slots for the next numDays
export function getAvailableSlots(input: GetAvailableSlotsInput): string[] {
  console.time('getAvailableSlots');
  const { now, numDays, schedule, busySlots } = input;
  const timezone = getTimezone(schedule);
  const scheduleExtension = getScheduleExtension(schedule);
  if (!scheduleExtension) {
    throw new Error('Schedule does not have schedule');
  }
  if (!timezone) {
    throw new Error('Schedule does not have a timezone');
  }
  // literally all slots based on open, close, buffers and capacity
  // no appointments or busy slots have been factored in
  const slotCapacityMap = getAllSlotsAsCapacityMap({
    now,
    finishDate: now.setZone(timezone).startOf('day').plus({ days: numDays }),
    scheduleExtension,
    timezone,
  });

  // console.log('slotCapacityMap', JSON.stringify(slotCapacityMap, null, 2));

  const availableSlots = removeBusySlots({
    slotCapacityMap,
    busySlots,
  });
  console.timeEnd('getAvailableSlots');

  return availableSlots;
}

export async function deleteSpecificBusySlot(start: string, locationID: string, oystehr: Oystehr): Promise<void> {
  console.log(`searching for busy-tentative slot with time ${start}`);
  const slotResources = (
    await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: [
        {
          name: 'schedule.actor',
          value: `Location/${locationID}`,
        },
        {
          name: 'status',
          value: 'busy-tentative',
        },
        { name: 'start', value: start },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  // only delete one busy-tentative slot for this time
  if (slotResources.length > 0 && slotResources[0].id) {
    console.log('deleting slot: ', JSON.stringify(slotResources[0]));
    await oystehr.fhir.delete({
      resourceType: 'Slot',
      id: slotResources[0].id,
    });
  } else {
    console.log('no slot to delete');
  }
}

export async function findOrCreateSchedule(
  oystehr: Oystehr,
  scheduleResource: Location | Practitioner | HealthcareService
): Promise<Schedule> {
  let schedule: Schedule;
  console.log(`searching for schedule resource for ${scheduleResource.resourceType}`, scheduleResource.id);
  const scheduleResources = (
    await oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [
        {
          name: 'actor',
          value: `${scheduleResource.resourceType}/${scheduleResource.id}`,
        },
      ],
    })
  ).unbundle();
  if (scheduleResources.length === 0) {
    console.log('no schedule resource found, creating one');
    schedule = await oystehr.fhir.create({
      resourceType: 'Schedule',
      actor: [
        {
          type: scheduleResource.resourceType,
          reference: `${scheduleResource.resourceType}/${scheduleResource.id}`,
        },
      ],
    });
  } else {
    schedule = scheduleResources[0];
  }
  console.log(`schedule id ${scheduleResource.resourceType}`, schedule.id);
  return schedule;
}

export async function makeSlotTentativelyBusy(
  slotTime: string,
  scheduleResource: Location | Practitioner | HealthcareService,
  oystehr: Oystehr
): Promise<Slot | undefined> {
  // create a slot
  console.log('creating a busy-tentative slot for time ', slotTime);
  if (!scheduleResource.id) return;
  const schedule: Schedule = await findOrCreateSchedule(oystehr, scheduleResource);
  const slotEnd = DateTime.fromISO(slotTime).plus({ minutes: 15 });
  const newSlot: Slot = await oystehr.fhir.create({
    resourceType: 'Slot',
    schedule: {
      type: 'Schedule',
      reference: `Schedule/${schedule.id}`,
    },
    start: slotTime,
    end: slotEnd.toISO() || '',
    status: 'busy-tentative',
  });
  return newSlot;
}

export async function checkBusySlots(
  oystehr: Oystehr,
  now: DateTime,
  numDays: number,
  scheduleResource: Location | Practitioner | HealthcareService
): Promise<Slot[]> {
  // convert now to location timezone
  const timeZone = getTimezone(scheduleResource);
  const nowForTimeZone = now.setZone(timeZone);
  // get iso date string for start and finnish time
  const { minimum: startTime, maximum: finishTime } = createMinimumAndMaximumTime(nowForTimeZone, numDays);

  console.log(
    `searching for busy-tentative slots based on ${scheduleResource.resourceType} ${scheduleResource.id}, for dates ${startTime} and ${finishTime}`
  );
  console.time('find_busy-tentative_slots');
  const requestParameters = [
    {
      name: 'status',
      value: 'busy-tentative',
    },
    { name: 'start', value: `ge${startTime}` },
    { name: 'start', value: `le${finishTime}` },
    { name: '_count', value: '1000' },
  ];

  if (scheduleResource.resourceType === 'Location') {
    requestParameters.push({
      name: 'schedule.actor',
      value: `Location/${scheduleResource.id}`,
    });
  }
  if (scheduleResource.resourceType === 'Practitioner') {
    requestParameters.push({
      name: 'schedule.actor',
      value: `Practitioner/${scheduleResource.id}`,
    });
  }
  if (scheduleResource.resourceType === 'HealthcareService') {
    requestParameters.push({
      name: 'schedule.actor',
      value: `HealthcareService/${scheduleResource.id}`,
    });
  }

  const slotResourcesAll = (
    await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: requestParameters,
    })
  ).unbundle();
  console.timeEnd('find_busy-tentative_slots');

  // check if any have not been updated in the last 10 minutes and delete em
  const slotRequests: BatchInputRequest<Slot>[] = [];
  const slotResources: Slot[] = [];
  slotResourcesAll.forEach((slot) => {
    const lastUpdated = DateTime.fromISO(slot.meta?.lastUpdated || '');
    const minutesSinceLastUpdate = nowForTimeZone.diff(lastUpdated, 'minutes').minutes;
    if (minutesSinceLastUpdate > 10) {
      if (!slot.id) return;
      const deleteSlotRequest: BatchInputDeleteRequest = {
        method: 'DELETE',
        url: `/Slot/${slot.id}`,
      };
      slotRequests.push(deleteSlotRequest);
    } else {
      slotResources.push(slot);
    }
  });

  if (slotRequests.length > 0) {
    try {
      console.log(`deleting ${slotRequests.length} expired busy-tentative slots`);
      console.time('delete_slots_batch');
      await oystehr.fhir.batch({ requests: slotRequests });
      console.timeEnd('delete_slots_batch');
    } catch (error) {
      console.log('error deleting expired busy-tentative slots', error, JSON.stringify(error));
    }
  } else {
    console.log('no slots to delete');
  }

  console.log(`${slotResources.length} slots are tentatively busy`);
  return slotResources;
}

export async function getAppointments(
  oystehr: Oystehr,
  now: DateTime,
  numDays: number,
  scheduleResource: Location | Practitioner | HealthcareService
): Promise<Appointment[]> {
  // convert now to location timezone
  const timeZone = getTimezone(scheduleResource);
  const nowForTimeZone = now.setZone(timeZone);

  // get iso date string for start and finish
  const { minimum: startTime, maximum: finishTime } = createMinimumAndMaximumTime(nowForTimeZone, numDays);

  // search for appointment resources using the specific location and get all appointments starting today and end of finishTime
  console.log(
    `searching for appointments based on ${scheduleResource.id} ${scheduleResource.id}, for dates ${startTime} and ${finishTime}`
  );
  console.time('get_appointments_at_location');
  const appointmentParameters = [
    {
      name: 'status:not',
      value: 'cancelled',
    },
    {
      name: 'status:not',
      value: 'noshow',
    },
    { name: 'date', value: `ge${startTime}` },
    { name: 'date', value: `le${finishTime}` },
    { name: '_count', value: '1000' },
  ];

  if (scheduleResource.resourceType === 'Location') {
    appointmentParameters.push({ name: 'location', value: `Location/${scheduleResource.id}` });
  }
  if (scheduleResource.resourceType === 'Practitioner') {
    appointmentParameters.push({ name: 'practitioner', value: `Practitioner/${scheduleResource.id}` });
  }
  if (scheduleResource.resourceType === 'HealthcareService') {
    appointmentParameters.push({ name: 'actor', value: `HealthcareService/${scheduleResource.id}` });
  }
  console.log(5, appointmentParameters);

  const appointmentResources = (
    await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: appointmentParameters,
    })
  ).unbundle();
  console.timeEnd('get_appointments_at_location');
  return appointmentResources;
}

export function filterAppointmentsByType(appointments: Appointment[], types: VisitType[]): Appointment[] {
  console.log(`filtering ${appointments.length} appointments to get ${types}`);
  const filteredAppointments = appointments.filter((appointment) => {
    const appointmentType = appointment?.appointmentType?.text as VisitType;
    if (types.includes(appointmentType)) {
      return appointment;
    }
    return;
  });
  console.log(`returning ${filteredAppointments.length} appointments`);
  return filteredAppointments;
}

export async function addWaitingMinutesToAppointment(
  appointment: Appointment,
  waitingMinutes: number,
  oystehr: Oystehr
): Promise<Appointment | undefined> {
  if (!appointment.id) {
    console.log('addWaitingMinutesToAppointment function could not get appointment id');
    return;
  }
  const tagOpForMinutes = getPatchOperationForNewMetaTag(appointment, {
    system: 'waiting-minutes-estimate',
    code: waitingMinutes.toString(),
  });
  const res: Appointment = await oystehr.fhir.patch({
    resourceType: 'Appointment',
    id: appointment.id,
    operations: [tagOpForMinutes],
  });
  return res;
}

interface GetSlotsInput {
  scheduleList: BookableScheduleData['scheduleList'];
  now: DateTime;
  numDays?: number;
  originalBookingUrl?: string;
  slotExpirationBiasInSeconds?: number; // this is for testing busy-tentative slot expiration
}

export const getAvailableSlotsForSchedules = async (
  input: GetSlotsInput,
  oystehr: Oystehr
): Promise<{
  availableSlots: SlotListItem[];
  telemedAvailable: SlotListItem[];
}> => {
  const { now, scheduleList, numDays, originalBookingUrl } = input;
  let telemedAvailable: SlotListItem[] = [];
  let availableSlots: SlotListItem[] = [];

  const getBusySlotsInput: GetSlotsInWindowInput = {
    scheduleIds: scheduleList.map((scheduleTemp) => scheduleTemp.schedule.id!),
    fromISO: now.toISO() ?? '',
    toISO:
      now
        .plus({ days: numDays ?? SCHEDULE_NUM_DAYS })
        .startOf('day')
        .toISO() ?? '',
    status: ['busy', 'busy-tentative', 'busy-unavailable'],
    filter: (slot: Slot) => {
      const thisMoment = DateTime.now().plus({ seconds: input.slotExpirationBiasInSeconds ?? 0 });
      if (slot.status === 'busy-tentative') {
        const lastUpdated = DateTime.fromISO(slot.meta?.lastUpdated || '');
        if (!lastUpdated.isValid) {
          return true;
        }
        const minutesSinceLastUpdate = lastUpdated.diff(thisMoment, 'minutes').minutes;
        return minutesSinceLastUpdate <= SLOT_BUSY_TENTATIVE_EXPIRATION_MINUTES;
      }
      return true;
    },
  };
  const allBusySlots = await getSlotsInWindow(getBusySlotsInput, oystehr);

  scheduleList.forEach((scheduleTemp) => {
    try {
      // todo 1.8: find busy / busy-tentative slots
      const busySlots: Slot[] = allBusySlots.filter((slot) => {
        const scheduleId = slot.schedule?.reference?.split('/')?.[1];
        return scheduleId === scheduleTemp.schedule.id && !getSlotIsPostTelemed(slot);
      });
      // console.log('getting post telemed slots');
      // todo: check busy slots for telemed
      const telemedTimes = getPostTelemedSlots(now, scheduleTemp.schedule, []);
      const slotStartsForSchedule = getAvailableSlots({
        now,
        numDays: numDays ?? SCHEDULE_NUM_DAYS,
        schedule: scheduleTemp.schedule,
        busySlots,
      });
      availableSlots.push(
        ...makeSlotListItems({
          startTimes: slotStartsForSchedule,
          scheduleId: scheduleTemp.schedule.id!,
          owner: scheduleTemp.owner,
          timezone: getTimezone(scheduleTemp.schedule),
          originalBookingUrl,
        })
      );
      telemedAvailable.push(
        ...makeSlotListItems({
          startTimes: telemedTimes,
          scheduleId: scheduleTemp.schedule.id!,
          owner: scheduleTemp.owner,
          timezone: getTimezone(scheduleTemp.schedule),
          originalBookingUrl,
        })
      );
      // console.log('available slots for schedule:', slotStartsForSchedule);
    } catch (err) {
      console.error(
        `Error trying to get slots for schedule item: Schedule/${scheduleTemp.schedule.id}`,
        JSON.stringify(err, null, 2),
        err
      );
    }
  });

  availableSlots = availableSlots.filter((slot) => {
    return DateTime.fromISO(slot.slot.start) >= now;
  });
  telemedAvailable = telemedAvailable.filter((slot) => {
    return DateTime.fromISO(slot.slot.start) >= now;
  });

  // this logic removes duplicate slots even across schedules,
  const usedSlots: { [time: string]: SlotListItem } = {};
  console.log('available slots before deduping:', availableSlots.length);
  const dedupedSlots = availableSlots
    .sort((a, b) => {
      const time1 = DateTime.fromISO(a.slot.start);
      const time2 = DateTime.fromISO(b.slot.start);
      return time1.diff(time2).toMillis();
    })
    .filter((slot) => {
      if (usedSlots[slot.slot.start]) {
        return false;
      }
      usedSlots[slot.slot.start] = slot;
      return true;
    });

  console.log('available slots after deduping:', dedupedSlots.length);

  return { availableSlots: dedupedSlots, telemedAvailable };
};

export const getSchedulesForGroup = (
  scheduleResource: HealthcareService,
  groupItems: (Location | Practitioner | HealthcareService)[]
): (Location | Practitioner | HealthcareService)[] => {
  const schedules: (Location | Practitioner | HealthcareService)[] = [];
  const hs = scheduleResource;
  const strategy = scheduleStrategyForHealthcareService(hs);
  if (strategy === ScheduleStrategy['owns']) {
    schedules.push(hs);
  } else if (strategy === ScheduleStrategy['poolsProviders']) {
    const providers = groupItems.filter((item) => {
      const { resourceType } = item;
      return resourceType === 'Practitioner';
    });
    schedules.push(...providers);
  } else if (strategy === ScheduleStrategy['poolsLocations']) {
    const locations = groupItems.filter((item) => {
      return item.resourceType === 'Location';
    });
    schedules.push(...locations);
  } else if (strategy === ScheduleStrategy['poolsAll']) {
    schedules.push(...groupItems);
  }
  return schedules;
};

interface MakeSlotListItemsInput {
  startTimes: string[];
  scheduleId: string;
  owner: Practitioner | Location | HealthcareService;
  timezone: Timezone;
  appointmentLengthInMinutes?: number;
  originalBookingUrl?: string;
}

export const makeSlotListItems = (input: MakeSlotListItemsInput): SlotListItem[] => {
  // todo: remove magic numbers
  const {
    startTimes,
    owner: ownerResource,
    scheduleId,
    timezone,
    appointmentLengthInMinutes = DEFAULT_APPOINTMENT_LENGTH_MINUTES,
    originalBookingUrl,
  } = input;
  return startTimes.map((startTime) => {
    const end = DateTime.fromISO(startTime).plus({ minutes: appointmentLengthInMinutes }).toISO() || '';
    let extension: Slot['extension'];
    if (originalBookingUrl) {
      extension = [makeBookingOriginExtensionEntry(originalBookingUrl)];
    }
    const slot: Slot = {
      resourceType: 'Slot',
      id: `${scheduleId}|${startTime}`,
      start: startTime,
      serviceCategory: getSlotServiceCategoryCodingFromScheduleOwner(ownerResource),
      end,
      schedule: { reference: `Schedule/${scheduleId}` },
      status: 'free',
      extension,
    };
    const owner = makeSlotOwnerFromResource(ownerResource);
    return {
      slot,
      owner,
      timezone,
    };
  });
};

const makeSlotOwnerFromResource = (owner: Practitioner | Location | HealthcareService): SlotOwner => {
  let name = '';
  if (owner.resourceType === 'Location') {
    name = (owner as Location).name || '';
  }
  if (owner.resourceType === 'Practitioner') {
    name = getFullName(owner as Practitioner) ?? '';
  }
  if (owner.resourceType === 'HealthcareService') {
    name = (owner as HealthcareService).name || '';
  }
  return {
    resourceType: owner.resourceType,
    id: owner.id!,
    name,
  };
};

export const nextAvailableFrom = (
  firstDate: DateTime | undefined,
  slotDataFHIR: Slot[],
  timezone: string
): DateTime | undefined => {
  if (firstDate == undefined) {
    return undefined;
  }
  const nextDaySlot = slotDataFHIR.find((slot) => {
    const dt = DateTime.fromISO(slot.start, { zone: timezone });
    if (dt.ordinal === firstDate.ordinal) {
      return false;
    }
    return dt > firstDate;
  });

  if (nextDaySlot) {
    return DateTime.fromISO(nextDaySlot.start, { zone: timezone });
  }
  return undefined;
};

export const normalizeSlotToUTC = (slotOriginal: Slot): Slot => {
  const slot = {
    ...slotOriginal,
  };
  const startTime = DateTime.fromISO(slot.start).setZone('UTC').toISO() || '';
  slot.start = startTime;
  const endTime = DateTime.fromISO(slot.end).setZone('UTC')?.toISO() ?? slot.end;
  slot.end = endTime;
  return slot;
};

export const SCHEDULE_CHANGES_DATE_FORMAT = 'MMM d';

export const BLANK_SCHEDULE_JSON_TEMPLATE: ScheduleExtension = {
  schedule: {
    monday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
    tuesday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
    wednesday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
    thursday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
    friday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
    saturday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
    sunday: {
      open: 8,
      close: 17,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 8,
          capacity: 0,
        },
        {
          hour: 9,
          capacity: 0,
        },
        {
          hour: 10,
          capacity: 0,
        },
        {
          hour: 11,
          capacity: 0,
        },
        {
          hour: 12,
          capacity: 0,
        },
        {
          hour: 13,
          capacity: 0,
        },
        {
          hour: 14,
          capacity: 0,
        },
        {
          hour: 15,
          capacity: 0,
        },
        {
          hour: 16,
          capacity: 0,
        },
        {
          hour: 17,
          capacity: 0,
        },
        {
          hour: 18,
          capacity: 0,
        },
        {
          hour: 19,
          capacity: 0,
        },
        {
          hour: 20,
          capacity: 0,
        },
      ],
    },
  },
  scheduleOverrides: {},
  closures: [],
};

export const fhirTypeForScheduleType = (scheduleType: ScheduleType): ScheduleOwnerFhirResource['resourceType'] => {
  if (scheduleType === 'location') {
    return 'Location';
  }
  if (scheduleType === 'provider') {
    return 'Practitioner';
  }
  return 'HealthcareService';
};

export interface GetSlotsInWindowInput {
  scheduleIds: string[];
  fromISO: string;
  toISO: string;
  status: Slot['status'][];
  filter?: (slot: Slot) => boolean;
}

export const getSlotsInWindow = async (input: GetSlotsInWindowInput, oystehr: Oystehr): Promise<Slot[]> => {
  const { scheduleIds, fromISO, toISO, status, filter } = input;
  const statusString = status.join(',');
  const statusParams = [
    {
      name: 'status',
      value: statusString,
    },
  ];
  const appointmentTypeParams = [
    {
      name: 'appointment-type:not',
      value: WALKIN_APPOINTMENT_TYPE_CODE,
    },
  ];
  const slots = (
    await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: [
        {
          name: 'schedule',
          value: scheduleIds.map((scheduleId) => `Schedule/${scheduleId}`).join(','),
        },
        {
          name: 'start',
          value: `ge${fromISO}`,
        },
        {
          name: 'start',
          value: `le${toISO}`,
        },
        ...appointmentTypeParams,
        ...statusParams,
      ],
    })
  ).unbundle();
  if (filter) {
    return slots.filter(filter);
  }
  return slots;
};

interface CheckSlotAvailableInput {
  slot: Slot;
  schedule: Schedule;
}
export const checkSlotAvailable = async (input: CheckSlotAvailableInput, oystehr: Oystehr): Promise<boolean> => {
  const getBusySlotsInput: GetSlotsInWindowInput = {
    scheduleIds: [input.schedule.id!],
    fromISO: input.slot.start,
    toISO: input.slot.end,
    status: ['busy', 'busy-tentative', 'busy-unavailable'],
  };
  const busySlots = await getSlotsInWindow(getBusySlotsInput, oystehr);
  console.log('found this many busy slots: ', busySlots.length);

  const startTime = DateTime.fromISO(input.slot.start);
  const dayStart = startTime.startOf('day');

  const getAvailableInput: GetAvailableSlotsInput = {
    now: dayStart,
    numDays: 1,
    schedule: input.schedule,
    busySlots,
  };
  const availableSlots = getAvailableSlots(getAvailableInput);

  //console.log('found this many available slots: ', availableSlots.length);

  // note this is just checking for same start times, and assumes length of slot is same as available slots
  // todo: improve the logic here; we need a better heuristic for slot equivalence since we have no persisted slots with ids to check
  // it's not so pressing at the moment since we're assuming a schedule only vends slots of equivalent type and length
  return availableSlots.some((slot) => {
    const slotTime = DateTime.fromISO(slot);
    if (slotTime !== null) {
      return slotTime.equals(startTime);
    }
    return false;
  });
};

export const getSlotServiceCategoryCodingFromScheduleOwner = (
  owner: ScheduleOwnerFhirResource
): Slot['serviceCategory'] | undefined => {
  // customization point - override this to return a specific service category given a known schedule owner. if a category is returned here,
  // the service modality may be inferred from the schedule owner. the service modality will then be used to specify the service mode for the appointment
  // when the slot is submitted to the create-appointment endpoint. alternatively, the service modality can be written to the slot directly by passing a value for
  // the serviceModality param to the create-slot endpoint. if a Slot has an express service modality set, that will take priority over any value returned here.

  // console.log('getting service category from schedule owner', owner);
  if (owner.resourceType === 'Location' && isLocationVirtual(owner as Location)) {
    return [SlotServiceCategory.virtualServiceMode];
  }

  // default to in-person service mode
  return [SlotServiceCategory.inPersonServiceMode];
};

export const getServiceModeFromScheduleOwner = (
  owner: ScheduleOwnerFhirResource,
  schedule?: Schedule
): ServiceMode | undefined => {
  // customization point - override this to return a specific service mode given a known schedule owner, or, optionally a schedule.
  // for use cases that offer virtual or in-person services but not both, the owner resource may be sufficient to determine the service mode.
  // for more complex cases, a given provider may offer both virtual and in-person services, and may wish to configure separate schedules for each service mode.
  // if a schedule with a specific service mode is provided, it will be used to determine the service mode for any slots returned against that schedule.
  // in any event, the value returned here may be overridden by passing a value for the serviceMode param to the create-slot endpoint.

  const scheduleServiceCategory = schedule?.serviceCategory;
  if (scheduleServiceCategory) {
    const isVirtual = scheduleServiceCategory.some((category) => {
      const codingList = category.coding ?? [];
      return codingList.some((coding) => {
        return codingContainedInList(coding, SlotServiceCategory.virtualServiceMode.coding!);
      });
    });
    if (isVirtual) {
      return ServiceMode.virtual;
    }
    const isInPerson = scheduleServiceCategory.some((category) => {
      const codingList = category.coding ?? [];
      return codingList.some((coding) => {
        return codingContainedInList(coding, SlotServiceCategory.inPersonServiceMode.coding!);
      });
    });
    if (isInPerson) {
      return ServiceMode['in-person'];
    }
  }

  // default to in-person service mode
  const [codeableConcept] = getSlotServiceCategoryCodingFromScheduleOwner(owner) || [];
  if (codeableConcept) {
    const coding = codeableConcept.coding?.[0] ?? {};
    if (codingContainedInList(coding, SlotServiceCategory.inPersonServiceMode.coding!)) {
      return ServiceMode['in-person'];
    }
    if (codingContainedInList(coding, SlotServiceCategory.virtualServiceMode.coding!)) {
      return ServiceMode.virtual;
    }
  }
  return undefined;
};

export const getServiceModeFromSlot = (slot: Slot): ServiceMode | undefined => {
  let serviceMode: ServiceMode | undefined;
  (slot.serviceCategory ?? []).forEach((category) => {
    const categoryCoding = category.coding?.[0] ?? {};
    if (codingContainedInList(categoryCoding, SlotServiceCategory.inPersonServiceMode.coding!)) {
      serviceMode = ServiceMode['in-person'];
    }
    if (codingContainedInList(categoryCoding, SlotServiceCategory.virtualServiceMode.coding!)) {
      serviceMode = ServiceMode.virtual;
    }
  });
  return serviceMode;
};

export const getSlotIsWalkin = (slot: Slot): boolean => {
  const appointmentType = slot.appointmentType?.coding?.[0];
  if (appointmentType) {
    return codingContainedInList(appointmentType, SLOT_WALKIN_APPOINTMENT_TYPE_CODING.coding!);
  }
  return false;
};

export const getSlotIsPostTelemed = (slot: Slot): boolean => {
  const appointmentType = slot.appointmentType?.coding?.[0];
  if (appointmentType) {
    return codingContainedInList(appointmentType, SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING.coding!);
  }
  return false;
};

export const getLocationHoursFromScheduleExtension = (extension: ScheduleExtension): LocationHoursOfOperation[] => {
  const hourEntries: LocationHoursOfOperation[] = [];
  const { schedule } = extension;

  Object.entries(schedule).forEach((keyVal) => {
    const [day, scheduleDay] = keyVal;
    const dayAbbrev = day.slice(0, 3).toLowerCase() as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
    console.log('day abbrev', dayAbbrev);
    const { open, close, workingDay } = scheduleDay;
    if (workingDay) {
      hourEntries.push({
        daysOfWeek: [dayAbbrev],
        openingTime: `${open}`,
        closingTime: `${close}`,
      });
    } else {
      hourEntries.push({
        daysOfWeek: [dayAbbrev],
      });
    }
  });

  return hourEntries;
};

interface OverrideOperatingHoursInput {
  from: DateTime;
  scheduleOverrides: ScheduleOverrides;
  dailySchedule: DailySchedule;
  timezone: Timezone;
}
export const applyOverridesToDailySchedule = (
  input: OverrideOperatingHoursInput
): { dailySchedule: DailySchedule; overriddenDay: ScheduleDay | undefined } => {
  const { from, scheduleOverrides, dailySchedule, timezone } = input;
  const currentDate = from.setZone(timezone);
  const overrideDate = Object.keys(scheduleOverrides).find((date) => {
    return currentDate.toFormat(OVERRIDE_DATE_FORMAT) === date;
  });
  if (overrideDate) {
    const dayOfWeek = currentDate.toLocaleString({ weekday: 'long' }, { locale: 'en-US' }).toLowerCase() as DOW;
    const override = scheduleOverrides[overrideDate];
    const dailyScheduleDay = dailySchedule[dayOfWeek];
    const overriddenDay = applyOverrideToDay(override, dailyScheduleDay);
    const newDailySchedule = {
      ...dailySchedule,
      [dayOfWeek]: overriddenDay,
    };
    return { dailySchedule: newDailySchedule, overriddenDay };
  }
  return { dailySchedule: { ...dailySchedule }, overriddenDay: undefined };
};

const applyOverrideToDay = (override: ScheduleOverrideDay, day: ScheduleDay): ScheduleDay => {
  const { open, close, openingBuffer, closingBuffer, hours } = override;
  return {
    open,
    close,
    openingBuffer,
    closingBuffer,
    workingDay: day.workingDay, // todo?: should this be overridable??
    hours,
  };
};

export const scheduleTypeFromFHIRType = (fhirType: FhirResource['resourceType']): ScheduleType => {
  if (fhirType === 'Location') {
    return ScheduleType.location;
  }
  if (fhirType === 'Practitioner') {
    return ScheduleType.provider;
  }
  return ScheduleType.group;
};

export const getAppointmentDurationFromSlot = (slot: Slot, unit: 'minutes' | 'hours' = 'minutes'): number => {
  const start = DateTime.fromISO(slot.start);
  const end = DateTime.fromISO(slot.end);
  const duration = end.diff(start, unit).toObject();
  return duration[unit] || 0;
};

interface ApplyBuffersInput {
  slots: SlotCapacityMap;
  openingBufferMinutes: number;
  closingBufferMinutes: number;
  openingTime: DateTime;
  closingTime: DateTime;
  now: DateTime;
}
export const applyBuffersToSlots = (input: ApplyBuffersInput): SlotCapacityMap => {
  const { slots, openingBufferMinutes, closingBufferMinutes, openingTime, closingTime, now } = input;
  const closingBufferApplied = removeSlotsAfter(slots, closingTime.minus({ minutes: closingBufferMinutes }));
  const beforeTime =
    openingTime.plus({ minutes: openingBufferMinutes }) > now
      ? openingTime.plus({ minutes: openingBufferMinutes })
      : now;
  const openingBufferApplied = removeSlotsBefore(closingBufferApplied, beforeTime);
  return openingBufferApplied;
};

const removeSlotsBefore = (slots: SlotCapacityMap, time: DateTime): SlotCapacityMap => {
  const filtered = Object.entries(slots).filter(([slotTimeISO, _]) => {
    const slotTime = DateTime.fromISO(slotTimeISO);
    return slotTime >= time;
  });
  return Object.fromEntries(filtered);
};

const removeSlotsAfter = (slots: SlotCapacityMap, time: DateTime): SlotCapacityMap => {
  const filtered = Object.entries(slots).filter(([slotTimeISO, _]) => {
    const slotTime = DateTime.fromISO(slotTimeISO);
    return slotTime < time;
  });
  return Object.fromEntries(filtered);
};

export const getOriginalBookingUrlFromSlot = (slot: Slot): string | undefined => {
  return slot.extension?.find((ext) => ext.url === SLOT_BOOKING_FLOW_ORIGIN_EXTENSION_URL)?.valueString;
};

interface CreateSlotOptions {
  status: Slot['status'];
  originalBookingUrl?: string;
  postTelemedLabOnly?: boolean;
}
export const createSlotParamsFromSlotAndOptions = (slot: Slot, options: CreateSlotOptions): CreateSlotParams => {
  const { status, originalBookingUrl, postTelemedLabOnly } = options;
  const walkin = getSlotIsWalkin(slot);
  return {
    scheduleId: slot.schedule.reference?.replace('Schedule/', '') ?? '',
    startISO: slot.start,
    serviceModality: getServiceModeFromSlot(slot) ?? ServiceMode['in-person'],
    lengthInMinutes: getAppointmentDurationFromSlot(slot),
    status,
    walkin,
    originalBookingUrl,
    postTelemedLabOnly,
  };
};
