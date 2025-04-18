import Oystehr, { BatchInputDeleteRequest, BatchInputRequest } from '@oystehr/sdk';
import {
  Appointment,
  Encounter,
  FhirResource,
  HealthcareService,
  Location,
  Practitioner,
  Resource,
  Schedule,
  Slot,
  LocationHoursOfOperation,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BookableScheduleData,
  Closure,
  ClosureType,
  getDateTimeFromDateAndTime,
  getFullName,
  getPatchOperationForNewMetaTag,
  OVERRIDE_DATE_FORMAT,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NUM_DAYS,
  ScheduleAndOwner,
  ScheduleOwnerFhirResource,
  ScheduleStrategy,
  scheduleStrategyForHealthcareService,
  ScheduleType,
  Timezone,
  SlotServiceCategory,
  ServiceMode,
  codingContainedInList,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  HOURS_OF_OPERATION_FORMAT,
  TIMEZONES,
  VisitType,
} from 'utils';
import {
  applyBuffersToSlots,
  createMinimumAndMaximumTime,
  distributeTimeSlots,
  divideHourlyCapacityBySlotInverval,
} from './dateUtils';

export const FIRST_AVAILABLE_SLOT_OFFSET_IN_MINUTES = 14;

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
  close: HourOfDay;
  openingBuffer: number;
  closingBuffer: number;
  workingDay: boolean;
  hours: Capacity[];
}

export interface ScheduleOverrideDay {
  open: HourOfDay;
  close: HourOfDay;
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

export function getScheduleDetails(
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

  const { schedule, scheduleOverrides, closures } = JSON.parse(scheduleExtension) as ScheduleExtension;
  return { schedule, scheduleOverrides, closures };
}

export function getTimezone(
  schedule: Pick<Location | Practitioner | HealthcareService | Schedule, 'extension' | 'resourceType' | 'id'>
): string {
  const timezone = schedule.extension?.find(
    (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
  )?.valueString;
  if (!timezone) {
    console.error('Schedule does not have timezone; returning default', schedule.resourceType, schedule.id);
    return TIMEZONES[0];
  }
  return timezone;
}

export const getAppointmentTimezone = (appointment: Appointment, scheduleResources: Resource[]): string => {
  const participantReferences =
    appointment.participant?.map((participant) => participant.actor?.reference).filter(Boolean) ?? [];

  const scheduleResource = scheduleResources.find(
    (resource) =>
      resource.resourceType && resource.id && participantReferences.includes(`${resource.resourceType}/${resource.id}`)
  );

  if (!scheduleResource) {
    console.error('Resource with Schedule extension not found in appointment.participant resources', scheduleResources);
  }

  const timezone = getTimezone(scheduleResource as Location | HealthcareService | Practitioner);

  return timezone;
};

// creates a map where each open hour in the day's schedule is a key and the capacity for that hour is the value
export function getSlotCapacityMapForDayAndSchedule(
  now: DateTime,
  schedule: DailySchedule,
  scheduleOverrides: ScheduleOverrides,
  closures: Closure[] | undefined
): SlotCapacityMap {
  let openingTime: HourOfDay | null = null;
  let closingTime: HourOfDay | 24 | null = null;
  let scheduleCapacityList: Capacity[] = [];
  let dayString = now.toFormat(OVERRIDE_DATE_FORMAT);

  console.log('day:', dayString, 'closures:', closures);
  if (closures) {
    for (const closure of closures) {
      if (closure.type === ClosureType.OneDay && closure.start === dayString) {
        console.log('closing day', dayString);
        return {};
      } else if (closure.type === ClosureType.Period) {
        const startClosure = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT).startOf('day');
        const endClosure = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT).endOf('day');
        if (now >= startClosure && now <= endClosure) {
          console.log('closing day', dayString);
          return {};
        }
      }
    }
  }

  const scheduleOverridden = Object.keys(scheduleOverrides).find((overrideTemp) => overrideTemp === dayString);
  console.log('day:', dayString, 'overrides:', Object.keys(scheduleOverrides));

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
  scheduleCapacityList?.forEach((slot) => {
    const firstSlotTimeForHour = getDateTimeFromDateAndTime(now, slot.hour);
    if (firstSlotTimeForHour.hour >= now.hour) {
      timeSlots = {
        ...timeSlots,
        ...divideHourlyCapacityBySlotInverval(now, firstSlotTimeForHour, slot.capacity, closingDateAndTime, 60),
      };
    }
  });

  const buffered = applyBuffersToSlots({
    hourlyCapacity: scheduleCapacityList,
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
  const { schedule } = getScheduleDetails(scheduleResource) || { schedule: undefined };
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
      : openingDateAndTime.plus({ hour: 1 });
  const timeSlots: { [slot: string]: number } = {};
  for (let temp = timeToStartSlots; temp < closingDateAndTime.minus({ hour: 2 }); temp = temp.plus({ minutes: 30 })) {
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
}
// returns all slots given current time, schedule, and timezone, irrespective of booked/busy status of any of those slots
export const getAllSlotsAsCapacityMap = (input: GetSlotCapacityMapInput): SlotCapacityMap => {
  const { now, finishDate, scheduleExtension, timezone } = input;
  const { schedule, scheduleOverrides, closures } = scheduleExtension;
  const nowForTimezone = now.setZone(timezone);
  let currentDayTemp = nowForTimezone;
  let slots = {};
  while (currentDayTemp < finishDate) {
    const slotsTemp = getSlotCapacityMapForDayAndSchedule(currentDayTemp, schedule, scheduleOverrides, closures);
    slots = { ...slots, ...slotsTemp };
    currentDayTemp = currentDayTemp.plus({ days: 1 }).startOf('day');
  }

  return slots;
};

interface GetAvailableSlotsInput {
  now: DateTime;
  numDays: number;
  schedule: Schedule;
  busySlots: Slot[]; // todo: add these in upstream
}

export function getAvailableSlots(input: GetAvailableSlotsInput): string[] {
  const { now, numDays, schedule, busySlots } = input;
  const timezone = getTimezone(schedule);
  const scheduleDetails = getScheduleDetails(schedule);
  if (!scheduleDetails) {
    throw new Error('schedule does not have schedule');
  }
  // literally all slots based on open, close, buffers and capacity
  // no appointments or busy slots have been factored in
  const slotCapacityMap = getAllSlotsAsCapacityMap({
    now,
    finishDate: now.plus({ days: numDays }),
    scheduleExtension: scheduleDetails,
    timezone,
  });

  const availableSlots = removeBusySlots({
    slotCapacityMap,
    busySlots,
  });

  return availableSlots;
}

export async function deleteSpecificBusySlot(start: string, locationID: string, oystehr: Oystehr): Promise<void> {
  console.log(`searching for busy-tenative slot with time ${start}`);
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
  // only delete one busy-tenative slot for this time
  if (slotResources.length > 0 && slotResources[0].id) {
    console.log('deleteing slot: ', JSON.stringify(slotResources[0]));
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
      console.log(`deleting ${slotRequests.length} expired busy-tenatative slots`);
      console.time('delete_slots_batch');
      await oystehr.fhir.batch({ requests: slotRequests });
      console.timeEnd('delete_slots_batch');
    } catch (error) {
      console.log('error deleting expired busy-tenatative slots', error, JSON.stringify(error));
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

  // search for appointment resources using the specific location and get all appointments starting today and end of finishtime
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
  busySlots?: Slot[];
}

export const getAvailableSlotsForSchedules = async (
  input: GetSlotsInput
): Promise<{
  availableSlots: SlotListItem[];
  telemedAvailable: SlotListItem[];
}> => {
  const { now, scheduleList } = input;
  const telemedAvailable: SlotListItem[] = [];
  const availableSlots: SlotListItem[] = [];

  const schedules: ScheduleAndOwner[] = scheduleList.map((scheduleTemp) => ({
    schedule: scheduleTemp.schedule,
    owner: scheduleTemp.owner,
  }));
  /*
  const [appointments, busySlots] = await Promise.all([
    getAppointments(oystehr, now, SCHEDULE_NUM_DAYS, scheduleResource),
    checkBusySlots(oystehr, now, SCHEDULE_NUM_DAYS, scheduleResource),
  ]);


  if (scheduleResource.resourceType === 'Location' || scheduleResource.resourceType === 'Practitioner') {
    schedules.push(scheduleResource);
  } else if (scheduleResource.resourceType === 'HealthcareService') {
    if (!groupItems) {
      const relatedScheduleResources = (
        await oystehr.fhir.search<Location | Practitioner | HealthcareService>({
          resourceType: 'HealthcareService',
          params: [
            { name: 'identifier', value: slug },
            {
              name: '_include',
              value: 'HealthcareService:location',
            },
            {
              name: '_revinclude',
              value: 'PractitionerRole:service',
            },
            {
              name: '_include:iterate',
              value: 'PractitionerRole:practitioner',
            },
          ],
        })
      ).unbundle();
      groupItems = relatedScheduleResources.filter(
        (resourceTemp) => resourceTemp.resourceType === 'Location' || resourceTemp.resourceType === 'Practitioner'
      );
    }
    schedules.push(...getSchedulesForGroup(scheduleResource, groupItems));
  }
    */

  schedules.forEach((scheduleTemp) => {
    try {
      // todo: find existing appointments and busy slots
      /*filterAppointmentsByType(appointments, [
        VisitType.PreBook,
        VisitType.WalkIn,
      ]);*/
      const busySlots: Slot[] = []; // checkBusySlots(oystehr, now, SCHEDULE_NUM_DAYS, scheduleTemp);
      // const postTelemedAppointments = filterAppointmentsByType(appointments, [VisitType.PostTelemed]);
      console.log('getting post telemed slots');
      const telemedTimes = getPostTelemedSlots(now, scheduleTemp.schedule, []);
      console.log('getting available slots to display');
      const slotStartsForSchedule = getAvailableSlots({
        now,
        numDays: SCHEDULE_NUM_DAYS,
        schedule: scheduleTemp.schedule,
        busySlots,
      });
      availableSlots.push(
        ...makeSlotListItems({
          startTimes: slotStartsForSchedule,
          scheduleId: scheduleTemp.schedule.id!,
          owner: scheduleTemp.owner,
        })
      );
      telemedAvailable.push(
        ...makeSlotListItems({
          startTimes: telemedTimes,
          scheduleId: scheduleTemp.schedule.id!,
          owner: scheduleTemp.owner,
        })
      );
      // console.log('available slots for schedule:', slotStartsForSchedule);
    } catch (err) {
      console.error(`Error trying to get slots for schedule item: Schedule/${scheduleTemp.schedule.id}`);
    }
  });

  // this logic removes duplicate slots even across schedules,
  const usedSlots: { [time: string]: SlotListItem } = {};
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
  appointmentLengthInMinutes?: number;
}

export const makeSlotListItems = (input: MakeSlotListItemsInput): SlotListItem[] => {
  const { startTimes, owner: ownerResource, scheduleId, appointmentLengthInMinutes = 15 } = input;
  return startTimes.map((startTime) => {
    const end = DateTime.fromISO(startTimes[0]).plus({ minutes: appointmentLengthInMinutes }).toISO() || '';
    const slot: Slot = {
      resourceType: 'Slot',
      id: `${scheduleId}-${startTime}`,
      start: startTime,
      end,
      schedule: { reference: `Schedule/${scheduleId}` },
      status: 'free',
    };
    const owner = makeSlotOwnerFromResource(ownerResource);
    return {
      slot,
      owner,
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

interface GetSlotsInWindowInput {
  scheduleId: string;
  fromISO: string;
  toISO: string;
  status: Slot['status'][];
}

export const getSlotsInWindow = async (input: GetSlotsInWindowInput, oystehr: Oystehr): Promise<Slot[]> => {
  const { scheduleId, fromISO, toISO, status } = input;
  const statusParams = status.map((statusTemp) => ({
    name: 'status',
    value: statusTemp,
  }));
  const slots = (
    await oystehr.fhir.search<Slot>({
      resourceType: 'Slot',
      params: [
        {
          name: 'schedule',
          value: `Schedule/${scheduleId}`,
        },
        {
          name: 'start',
          value: `ge${fromISO}`,
        },
        {
          name: 'start',
          value: `le${toISO}`,
        },
        {
          name: 'appointment-type:not',
          value: 'WALKIN',
        },
        ...statusParams,
      ],
    })
  ).unbundle();
  return slots;
};

interface CheckSlotAvailableInput {
  slot: Slot;
  schedule: Schedule;
}
export const checkSlotAvailable = async (input: CheckSlotAvailableInput, oystehr: Oystehr): Promise<boolean> => {
  const getBusySlotsInput: GetSlotsInWindowInput = {
    scheduleId: input.schedule.id!,
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
  // note this is just checking for same start times, and assumes length of slot is same as available slots
  // todo: improve the logic here
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

  console.log('getting service category from schedule owner', owner);

  // default to in-person service mode
  return [SlotServiceCategory.inPersonServiceMode];
};

export const getServiceModeFromScheduleOwner = (owner: ScheduleOwnerFhirResource): ServiceMode | undefined => {
  // customization point - override this to return a specific service category given a known schedule owner. if a category is returned here,
  // the service modality may be inferred from the schedule owner. the service modality will then be used to specify the service mode for the appointment
  // when the slot is submitted to the create-appointment endpoint. alternatively, the service modality can be written to the slot directly by passing a value for
  // the serviceModality param to the create-slot endpoint. if a Slot has an express service modality set, that will take priority over any value returned here.

  // default to in-person service mode
  const [codeableConcept] = getSlotServiceCategoryCodingFromScheduleOwner(owner) || [];
  if (codeableConcept) {
    const coding = codeableConcept.coding?.[0] ?? {};
    if (codingContainedInList(coding, [SlotServiceCategory.inPersonServiceMode])) {
      return ServiceMode['in-person'];
    }
    if (codingContainedInList(coding, [SlotServiceCategory.virtualServiceMode])) {
      return ServiceMode.virtual;
    }
  }
  return undefined;
};

export const getServiceModeFromSlot = (slot: Slot): ServiceMode | undefined => {
  let serviceMode: ServiceMode | undefined;
  (slot.serviceCategory ?? []).forEach((category) => {
    if (codingContainedInList(category, [SlotServiceCategory.inPersonServiceMode])) {
      serviceMode = ServiceMode['in-person'];
    }
    if (codingContainedInList(category, [SlotServiceCategory.virtualServiceMode])) {
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
  hoursOfOperation: LocationHoursOfOperation[];
  timezone: Timezone;
}
export const applyOverridesToOperatingHours = (input: OverrideOperatingHoursInput): LocationHoursOfOperation[] => {
  const { from, scheduleOverrides, hoursOfOperation, timezone } = input;
  const currentDate = from.setZone(timezone);
  const overrideDate = Object.keys(scheduleOverrides).find((date) => {
    return currentDate.toFormat(OVERRIDE_DATE_FORMAT) === date;
  });
  if (overrideDate) {
    const dayOfWeek = currentDate.toFormat('EEE').toLowerCase();
    const override = scheduleOverrides[overrideDate];
    const dayIndex = hoursOfOperation?.findIndex((hour) => (hour.daysOfWeek as string[])?.includes(dayOfWeek));
    if (hoursOfOperation && typeof dayIndex !== 'undefined' && dayIndex >= 0) {
      hoursOfOperation[dayIndex].openingTime = DateTime.fromFormat(override.open.toString(), 'h')
        .set({
          year: currentDate.year,
          month: currentDate.month,
          day: currentDate.day,
        })
        .toFormat(HOURS_OF_OPERATION_FORMAT);
      hoursOfOperation[dayIndex].closingTime = DateTime.fromFormat(override.close.toString(), 'h')
        .set({
          year: currentDate.year,
          month: currentDate.month,
          day: currentDate.day,
        })
        .toFormat(HOURS_OF_OPERATION_FORMAT);
    }
  }
  return hoursOfOperation;
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
