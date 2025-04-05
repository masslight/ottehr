import Oystehr, { BatchInputDeleteRequest, BatchInputRequest } from '@oystehr/sdk';
import { Appointment, Location, Schedule, Slot, Encounter, Practitioner, HealthcareService, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  Closure,
  ClosureType,
  getDateTimeFromDateAndTime,
  getPatchOperationForNewMetaTag,
  OVERRIDE_DATE_FORMAT,
  VisitType,
  scheduleStrategyForHealthcareService,
  ScheduleStrategy,
  SCHEDULE_NUM_DAYS,
  SCHEDULE_EXTENSION_URL,
  BookableScheduleData,
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

export type SlotCapacityMap = { [slot: string]: number };

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
    `extracting schedule and possible overrides from extention on ${scheduleResource.resourceType}`,
    scheduleResource.id
  );
  const scheduleExtension = scheduleResource?.extension?.find(function (extensionTemp) {
    return extensionTemp.url === SCHEDULE_EXTENSION_URL;
  })?.valueString;

  if (!scheduleExtension) return undefined;

  const { schedule, scheduleOverrides, closures } = JSON.parse(scheduleExtension) as ScheduleExtension;
  return { schedule, scheduleOverrides, closures };
}

export function getTimezone(schedule: Location | Practitioner | HealthcareService | Schedule): string {
  const timezone = schedule.extension?.find(
    (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
  )?.valueString;
  if (!timezone) {
    console.error('Schedule does not have timezone', schedule.resourceType, schedule.id);
    throw new Error('schedule does not have timezone');
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

export function getPostTelemedSlots(
  now: DateTime,
  scheduleResource: Location | Practitioner | HealthcareService,
  appointments: Appointment[]
): string[] {
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
  availableSlots: string[];
  telemedAvailable: string[];
}> => {
  const { now, scheduleList } = input;
  const telemedAvailable: string[] = [];
  const availableSlots: string[] = [];

  const schedules: Schedule[] = scheduleList.map((scheduleTemp) => scheduleTemp.schedule);
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
      // telemedAvailable.push(...getPostTelemedSlots(now, scheduleTemp, postTelemedAppointments));
      console.log('getting available slots to display');
      availableSlots.push(
        ...getAvailableSlots({
          now,
          numDays: SCHEDULE_NUM_DAYS,
          schedule: scheduleTemp,
          busySlots,
        })
      );
    } catch (err) {
      console.error(`Error trying to get slots for schedule item: ${scheduleTemp.resourceType}/${scheduleTemp.id}`);
    }
  });

  const usedSlots = new Set<string>();
  const dedupedSlots = availableSlots
    .sort((a, b) => {
      const time1 = DateTime.fromISO(a);
      const time2 = DateTime.fromISO(b);
      return time1.diff(time2).toMillis();
    })
    .filter((slot) => {
      if (usedSlots.has(slot)) {
        return false;
      }
      usedSlots.add(slot);
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
