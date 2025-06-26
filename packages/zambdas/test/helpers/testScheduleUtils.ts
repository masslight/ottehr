import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Location, LocationHoursOfOperation, Patient, RelatedPerson, Schedule } from 'fhir/r4b';
import _ from 'lodash';
import { DateTime } from 'luxon';
import {
  Capacity,
  Closure,
  ClosureType,
  DailySchedule,
  DOW,
  FHIR_BASE_URL,
  HourOfDay,
  OVERRIDE_DATE_FORMAT,
  SCHEDULE_EXTENSION_URL,
  ScheduleDay,
  ScheduleExtension,
  ScheduleOverrides,
  ScheduleOwnerFhirResource,
  SLUG_SYSTEM,
} from 'utils';

const DAYS_LONG = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
type DayLong = (typeof DAYS_LONG)[number];

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayOfWeek = (typeof DAYS)[number];

interface StartOfDayParams {
  date?: DateTime;
  timezone?: string;
}
export const startOfDayWithTimezone = (input?: StartOfDayParams): DateTime => {
  const baseDate = input?.date ?? DateTime.now();
  const timezone = input?.timezone ?? DEFAULT_TEST_TIMEZONE;
  return DateTime.fromFormat(baseDate.toFormat('MM/dd/yyyy'), 'MM/dd/yyyy', { zone: timezone });
};

// todo: avoid name collision with fhir resource
export interface ScheduleDTO {
  [day: DayLong]: {
    open: number;
    close: number;
    openingBuffer: number;
    closingBuffer: number;
    workingDay: boolean;
    hours: {
      hour: number;
      capacity: number;
    }[];
  };
}

export interface HoursOfOpConfig {
  dayOfWeek: DayLong;
  open: HourOfDay;
  close: HourOfDay | 24;
  workingDay: boolean;
}

interface CreateScheduleConfig {
  hoursInfo: HoursOfOpConfig;
  hourlyCapacity: number;
  schedule: ScheduleDTO;
  openingBuffer: number;
  closingBuffer: number;
}

export interface OverrideScheduleConfig {
  date: DateTime;
  open: HourOfDay;
  close: HourOfDay | 24;
  openingBuffer: number;
  closingBuffer: number;
  hourlyCapacity: number;
  granularCapacityOverride?: Capacity[];
}

const getStringTime = (hour: number): string => {
  return DateTime.fromObject({ hour: hour, minute: 0, second: 0 }).toFormat('HH:mm:ss');
};

export const getGenericHoursOfOperation = (): LocationHoursOfOperation[] => {
  const openTime = getStringTime(5);
  const closeTime = getStringTime(23);
  const hoursOfOp: LocationHoursOfOperation[] = [];
  DAYS.forEach((day) => {
    hoursOfOp.push({
      openingTime: openTime,
      closingTime: closeTime,
      daysOfWeek: [day],
    });
  });
  return hoursOfOp;
};

export const editHoursOfOperationForDay = (
  editDetails: HoursOfOpConfig,
  hours: LocationHoursOfOperation[]
): LocationHoursOfOperation[] => {
  const { dayOfWeek, open, close, workingDay } = editDetails;
  const dayShort = dayOfWeek.substring(0, 3) as DayOfWeek;
  const hourIndex = hours.findIndex((hourDetail) => hourDetail.daysOfWeek?.includes(dayShort));
  // if working day is false, the actual codebase removes that particular day entirely from hours of operation, and the logic below simulates that
  if (!workingDay && hourIndex !== -1) {
    hours.splice(hourIndex, 1);
    return hours;
  }
  if (hourIndex !== -1) {
    hours[hourIndex].openingTime = getStringTime(open);
    hours[hourIndex].closingTime = getStringTime(close);
  }
  return hours;
};

export const createGenericSchedule = (open: HourOfDay, close: HourOfDay | 24): ScheduleDTO => {
  const schedule: ScheduleDTO = {};
  DAYS_LONG.forEach((day) => {
    schedule[day] = {
      open: open,
      close: close,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: Array.from({ length: 24 }, (_, i) => {
        let capacity = 4;
        if (i < open || i >= close) {
          capacity = 0;
        }
        return { hour: i, capacity };
      }),
    };
  });
  return schedule;
};

export const updateScheduleForDay = ({
  hoursInfo,
  hourlyCapacity,
  schedule,
  openingBuffer,
  closingBuffer,
}: CreateScheduleConfig): ScheduleDTO => {
  const { dayOfWeek, open, close, workingDay } = hoursInfo;
  const adjustedClose = close === 0 ? 24 : close;
  schedule[dayOfWeek].open = open;
  schedule[dayOfWeek].close = adjustedClose;
  schedule[dayOfWeek].hours = Array.from({ length: adjustedClose - open }, (_, i) => ({
    hour: i + open,
    capacity: hourlyCapacity,
  }));
  if (openingBuffer) {
    schedule[dayOfWeek].openingBuffer = openingBuffer;
  }
  if (closingBuffer) {
    schedule[dayOfWeek].closingBuffer = closingBuffer;
  }
  schedule[dayOfWeek].workingDay = workingDay;
  return schedule;
};

export const makeLocation = (operationHours: LocationHoursOfOperation[]): Location => {
  return {
    resourceType: 'Location',
    id: randomUUID(),
    status: 'active',
    name: 'Location Test',
    description: 'Location Test',
    identifier: [
      {
        use: 'usual',
        system: SLUG_SYSTEM,
        value: 'test-test',
      },
      {
        use: 'usual',
        system: `${FHIR_BASE_URL}/r4/facility-name`,
        value: 'TEST',
      },
    ],
    hoursOfOperation: operationHours,
  };
};

interface MakeTestScheduleInput {
  processId?: string;
  locationRef?: string;
  scheduleJsonString?: string;
  scheduleObject?: ScheduleExtension;
}

export const DELETABLE_RESOURCE_CODE_PREFIX = 'DELETE_ME-';

export const DEFAULT_TEST_TIMEZONE = 'America/New_York';

export const tagForProcessId = (processId?: string): string => {
  return `${DELETABLE_RESOURCE_CODE_PREFIX}${processId ?? ''}`;
};

export const makeSchedule = (input: MakeTestScheduleInput): Schedule => {
  const { scheduleJsonString, scheduleObject, processId, locationRef } = input;
  let json = '';
  if (!scheduleJsonString && !scheduleObject) {
    throw new Error('scheduleJsonString or scheduleObject must be provided');
  } else if (scheduleJsonString) {
    json = scheduleJsonString;
  } else if (scheduleObject) {
    json = JSON.stringify(scheduleObject);
  }

  return {
    resourceType: 'Schedule',
    id: randomUUID(),
    actor: [
      {
        reference: locationRef ?? `Location/${randomUUID()}`,
      },
    ],
    extension: [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/timezone',
        valueString: DEFAULT_TEST_TIMEZONE,
      },
      {
        url: SCHEDULE_EXTENSION_URL,
        valueString: json,
      },
    ],
    meta: {
      tag: [
        {
          system: 'OTTEHR_AUTOMATED_TEST',
          code: tagForProcessId(processId),
          display: 'a test resource that should be cleaned up',
        },
      ],
    },
  };
};

export const setHourlyCapacity = (schedule: DailySchedule, day: DOW, hour: number, capacity: number): DailySchedule => {
  const daySchedule = schedule[day];
  const hoursToUpdate = schedule[day].hours;
  const updatedHours = hoursToUpdate.map((hourlyCapacity) => {
    if (hourlyCapacity.hour === hour) {
      return { ...hourlyCapacity, capacity: capacity };
    }
    return hourlyCapacity;
  });
  return {
    ...schedule,
    [day]: {
      ...daySchedule,
      hours: updatedHours,
    },
  };
};

export const replaceSchedule = (currentSchedule: Schedule, newExtension: ScheduleExtension): Schedule => {
  const scheduleIdx = currentSchedule.extension?.findIndex((ext) => ext.url === SCHEDULE_EXTENSION_URL);
  const modifiedSchedule: Schedule = { ...currentSchedule };
  if (scheduleIdx !== undefined && scheduleIdx >= 0 && modifiedSchedule.extension) {
    modifiedSchedule.extension[scheduleIdx] = {
      ...modifiedSchedule.extension[scheduleIdx],
      valueString: JSON.stringify(newExtension),
    };
    return modifiedSchedule;
  } else {
    return currentSchedule;
  }
};

export const createOverrideSchedule = (
  scheduleOverrides: ScheduleOverrides,
  input: OverrideScheduleConfig
): ScheduleOverrides => {
  const { date, open, close, openingBuffer, closingBuffer, hourlyCapacity } = input;
  const dateString = date.toFormat(OVERRIDE_DATE_FORMAT);
  scheduleOverrides = {
    ...scheduleOverrides,
    [dateString]: {
      open: open,
      close: close,
      openingBuffer: openingBuffer,
      closingBuffer: closingBuffer,
      hours: Array.from({ length: 24 }, (_, i) => {
        let capacity = 0;
        if (i >= open && i < close) {
          capacity = hourlyCapacity;
        }
        return { hour: i, capacity } as Capacity;
      }),
    },
  };
  return scheduleOverrides;
};

export const makeLocationWithSchedule = (
  hoursInfo: HoursOfOpConfig[],
  hourlyCapacity: number,
  openingBuffer: number,
  closingBuffer: number,
  overrideInfo?: OverrideScheduleConfig[],
  closures: Closure[] = []
): { schedule: Schedule; location: Location } => {
  let operationHours: LocationHoursOfOperation[] = getGenericHoursOfOperation();
  let scheduleDTO: ScheduleDTO | undefined;
  hoursInfo.forEach((hoursInfoForDay) => {
    operationHours = editHoursOfOperationForDay(hoursInfoForDay, operationHours);
    scheduleDTO = updateScheduleForDay({
      hoursInfo: hoursInfoForDay,
      hourlyCapacity,
      schedule: scheduleDTO ?? createGenericSchedule(hoursInfoForDay.open, hoursInfoForDay.close),
      openingBuffer,
      closingBuffer,
    });
  });

  let scheduleOverrides: ScheduleOverrides = {};
  if (overrideInfo && overrideInfo.length > 0) {
    overrideInfo.map((override) => {
      scheduleOverrides = createOverrideSchedule(scheduleOverrides, override);
    });
  }

  if (!scheduleDTO) {
    throw new Error('you messed up');
  }

  const scheduleComplete = { schedule: scheduleDTO, scheduleOverrides, closures };
  const scheduleString = JSON.stringify(scheduleComplete);
  const location = makeLocation(operationHours);
  const schedule = makeSchedule({
    locationRef: `Location/${location.id}`,
    scheduleJsonString: scheduleString,
    processId: randomUUID(),
  });
  return { location, schedule };
};

// 4 slots per hour, 24 hours a day
export const DEFAULT_SCHEDULE_JSON: ScheduleExtension = {
  schedule: {
    monday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
    tuesday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
    wednesday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
    thursday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
    friday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
    saturday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
    sunday: {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      workingDay: true,
      hours: [
        {
          hour: 0,
          capacity: 4,
        },
        {
          hour: 1,
          capacity: 4,
        },
        {
          hour: 2,
          capacity: 4,
        },
        {
          hour: 3,
          capacity: 4,
        },
        {
          hour: 4,
          capacity: 4,
        },
        {
          hour: 5,
          capacity: 4,
        },
        {
          hour: 6,
          capacity: 4,
        },
        {
          hour: 7,
          capacity: 4,
        },
        {
          hour: 8,
          capacity: 4,
        },
        {
          hour: 9,
          capacity: 4,
        },
        {
          hour: 10,
          capacity: 4,
        },
        {
          hour: 11,
          capacity: 4,
        },
        {
          hour: 12,
          capacity: 4,
        },
        {
          hour: 13,
          capacity: 4,
        },
        {
          hour: 14,
          capacity: 4,
        },
        {
          hour: 15,
          capacity: 4,
        },
        {
          hour: 16,
          capacity: 4,
        },
        {
          hour: 17,
          capacity: 4,
        },
        {
          hour: 18,
          capacity: 4,
        },
        {
          hour: 19,
          capacity: 4,
        },
        {
          hour: 20,
          capacity: 4,
        },
        {
          hour: 21,
          capacity: 4,
        },
        {
          hour: 22,
          capacity: 4,
        },
        {
          hour: 23,
          capacity: 4,
        },
      ],
    },
  },
  scheduleOverrides: {},
  closures: [],
};

interface BufferDef {
  openingBuffer?: number;
  closingBuffer?: number;
}

export const applyBuffersToScheduleExtension = (
  scheduleExt: ScheduleExtension,
  bufferDef: BufferDef
): ScheduleExtension => {
  const scheduleExtCopy = _.cloneDeep(scheduleExt);
  const { openingBuffer, closingBuffer } = bufferDef;
  const schedule = scheduleExtCopy.schedule;

  const updatedEntries = Object.entries(schedule).map(([day, daySchedule]) => {
    const newOpeningBuffer = openingBuffer ?? daySchedule.openingBuffer;
    const newClosingBuffer = closingBuffer ?? daySchedule.closingBuffer;

    return [day, { ...daySchedule, openingBuffer: newOpeningBuffer, closingBuffer: newClosingBuffer }];
  });
  const scheduleNew = Object.fromEntries(updatedEntries) as ScheduleExtension['schedule'];
  return {
    ...scheduleExtCopy,
    schedule: scheduleNew,
  };
};

export const changeAllCapacities = (scheduleExt: ScheduleExtension, newCapacity: number): ScheduleExtension => {
  const scheduleExtCopy = _.cloneDeep(scheduleExt);
  const schedule = scheduleExtCopy.schedule;

  const updatedEntries = Object.entries(schedule).map(([day, daySchedule]) => {
    const { hours } = daySchedule;
    const updatedHours = hours.map((hourObj) => {
      return { ...hourObj, capacity: newCapacity };
    });
    return [day, { ...daySchedule, hours: updatedHours }];
  });
  const scheduleNew = Object.fromEntries(updatedEntries) as ScheduleExtension['schedule'];
  return {
    ...scheduleExtCopy,
    schedule: scheduleNew,
  };
};

export const setSlotLengthInMinutes = (scheduleExt: ScheduleExtension, slotLength: number): ScheduleExtension => {
  const scheduleExtCopy = _.cloneDeep(scheduleExt);
  return {
    ...scheduleExtCopy,
    slotLength,
  };
};

export const addClosurePeriod = (
  scheduleExt: ScheduleExtension,
  start: DateTime,
  lengthInDays: number
): ScheduleExtension => {
  const scheduleExtCopy = _.cloneDeep(scheduleExt);
  const closure: Closure = {
    type: ClosureType.Period,
    start: start.toFormat(OVERRIDE_DATE_FORMAT),
    end: start.plus({ days: lengthInDays }).toFormat(OVERRIDE_DATE_FORMAT),
  };
  console.log('closure: ', closure);
  return {
    ...scheduleExtCopy,
    closures: [...(scheduleExtCopy.closures ?? []), closure],
  };
};

export const addClosureDay = (scheduleExt: ScheduleExtension, start: DateTime): ScheduleExtension => {
  const scheduleExtCopy = _.cloneDeep(scheduleExt);
  const closure: Closure = {
    type: ClosureType.OneDay,
    start: start.toFormat(OVERRIDE_DATE_FORMAT),
    end: start.toFormat(OVERRIDE_DATE_FORMAT),
  };
  console.log('closure: ', closure);
  return {
    ...scheduleExtCopy,
    closures: [...(scheduleExtCopy.closures ?? []), closure],
  };
};

export const addOverrides = (
  scheduleExt: ScheduleExtension,
  overrides: OverrideScheduleConfig[]
): ScheduleExtension => {
  const overridesToAdd: ScheduleOverrides = {};
  const scheduleExtCopy = _.cloneDeep(scheduleExt);

  overrides.forEach((override) => {
    const dateString = override.date.startOf('day').toFormat(OVERRIDE_DATE_FORMAT);
    const granularCapacityOverride = override.granularCapacityOverride ?? [];
    overridesToAdd[dateString] = {
      open: override.open,
      close: override.close,
      openingBuffer: override.openingBuffer,
      closingBuffer: override.closingBuffer,
      hours: Array.from({ length: 24 }, (_, i) => {
        let capacity = 0;
        if (i >= override.open && i < override.close) {
          const granularOverride = granularCapacityOverride.find((g) => g.hour === i);
          capacity = granularOverride?.capacity ?? override.hourlyCapacity;
        }
        return { hour: i, capacity } as Capacity;
      }),
    };
  });
  return {
    ...scheduleExtCopy,
    scheduleOverrides: {
      ...(scheduleExtCopy.scheduleOverrides || {}),
      ...overridesToAdd,
    },
  };
};

export const adjustHoursOfOperation = (
  scheduleExt: ScheduleExtension,
  hoursOfOp: HoursOfOpConfig[]
): ScheduleExtension => {
  const scheduleExtCopy = _.cloneDeep(scheduleExt);
  const schedule = scheduleExtCopy.schedule;

  const updatedEntries = Object.entries(schedule).map(([day, daySchedule]) => {
    const hoursToSet = hoursOfOp.find((hours) => hours.dayOfWeek === day);
    if (hoursToSet) {
      const { open, close, workingDay } = hoursToSet;
      return [
        day,
        {
          ...daySchedule,
          open,
          close,
          workingDay,
        },
      ];
    }
    return [day, daySchedule];
  });
  const scheduleNew = Object.fromEntries(updatedEntries) as ScheduleExtension['schedule'];
  return {
    ...scheduleExtCopy,
    schedule: scheduleNew,
  };
};

interface PersistScheduleInput {
  scheduleExtension: ScheduleExtension;
  processId: string | null;
  scheduleOwner?: ScheduleOwnerFhirResource;
}

interface PersistScheduleOutput {
  schedule: Schedule;
  owner?: ScheduleOwnerFhirResource;
}

export const persistSchedule = async (
  input: PersistScheduleInput,
  oystehr: Oystehr
): Promise<PersistScheduleOutput> => {
  const { scheduleExtension, processId, scheduleOwner } = input;
  if (processId === null) {
    throw new Error('processId is null');
  }

  let makeOwnerRequest: BatchInputPostRequest<FhirResource> | undefined;
  if (scheduleOwner) {
    makeOwnerRequest = {
      method: 'POST',
      url: scheduleOwner.resourceType,
      resource: scheduleOwner,
      fullUrl: `urn:uuid:${randomUUID()}`,
    };
  }
  const resource = {
    ...makeSchedule({
      processId,
      scheduleObject: scheduleExtension,
      locationRef: makeOwnerRequest ? makeOwnerRequest.fullUrl : undefined,
    }),
    id: undefined,
  };

  if (makeOwnerRequest) {
    const results = await oystehr.fhir.transaction({
      requests: [
        makeOwnerRequest,
        {
          method: 'POST',
          url: 'Schedule',
          resource,
        },
      ],
    });
    const schedule = results.entry?.find((entry) => entry.resource?.resourceType === 'Schedule')?.resource as Schedule;
    const owner = results.entry?.find((entry) => entry.resource?.resourceType === scheduleOwner?.resourceType)
      ?.resource as ScheduleOwnerFhirResource;
    return { schedule, owner };
  }
  const schedule = await oystehr.fhir.create<Schedule>(resource);
  return { schedule, owner: undefined };
};

export const getScheduleDay = (scheduleExt: ScheduleExtension, day: DateTime): ScheduleDay | undefined => {
  const weekday = day.toFormat('cccc').toLowerCase() as DOW;
  console.log('weekday', weekday);
  const scheduleDay = scheduleExt.schedule[weekday as DOW];
  console.log('scheduleDay', scheduleDay);
  return scheduleDay;
};

export const cleanupTestScheduleResources = async (processId: string, oystehr: Oystehr): Promise<void> => {
  if (!oystehr || !processId) {
    throw new Error('oystehr or processId is null! could not clean up!');
  }
  const schedulesAndSuch = (
    await oystehr.fhir.search<FhirResource>({
      resourceType: 'Schedule',
      params: [
        {
          name: '_tag',
          value: tagForProcessId(processId),
        },
        {
          name: '_include',
          value: 'Schedule:actor',
        },
        {
          name: '_revinclude',
          value: 'Slot:schedule',
        },
      ],
    })
  ).unbundle();

  const patientsAndThings = (
    await oystehr.fhir.search<FhirResource>({
      resourceType: 'Patient',
      params: [
        {
          name: '_tag',
          value: tagForProcessId(processId),
        },
        {
          name: '_revinclude',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:link:RelatedPerson',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:patient',
        },
        {
          name: '_revinclude',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude:iterate',
          value: 'QuestionnaireResponse:encounter',
        },
      ],
    })
  ).unbundle();
  const deleteRequests: BatchInputDeleteRequest[] = [...schedulesAndSuch, ...patientsAndThings].map((res) => {
    return {
      method: 'DELETE',
      url: `${res.resourceType}/${res.id}`,
    };
  });
  try {
    await oystehr.fhir.batch({ requests: deleteRequests });
  } catch (error) {
    console.error('Error deleting schedules', error);
    console.log(`ProcessId ${processId} may need manual cleanup`);
  }
};

export const makeTestPatient = (partial?: Partial<Patient>): Patient => {
  const base = partial ?? {};
  const patient: Patient = {
    name: [
      {
        use: 'official',
        given: ['Olha'],
        family: 'Test0418',
      },
    ],
    active: true,
    gender: 'female',
    address: [
      {
        city: 'Pembroke Pine',
        line: ['street address new'],
        state: 'CA',
        country: 'US',
        postalCode: '06001',
      },
    ],
    contact: [
      {
        telecom: [
          {
            value: '+12027139680',
            system: 'phone',
            extension: [
              {
                url: 'https://extensions.fhir.oystehr.com/contact-point/telecom-phone-erx',
                valueString: 'erx',
              },
            ],
          },
        ],
      },
    ],
    telecom: [
      {
        value: 'okovalenko+testnew@masslight.com',
        system: 'email',
      },
      {
        value: '+12027139680',
        system: 'phone',
      },
    ],
    birthDate: '2005-07-18',
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity',
        valueCodeableConcept: {
          coding: [
            {
              code: '2135-2',
              system: 'http://terminology.hl7.org/CodeSystem/v3-Ethnicity',
              display: 'Hispanic or Latino',
            },
          ],
        },
      },
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/race',
        valueCodeableConcept: {
          coding: [
            {
              code: '1002-5',
              system: 'http://terminology.hl7.org/CodeSystem/v3-Race',
              display: 'American Indian or Alaska Native',
            },
          ],
        },
      },
    ],
    resourceType: 'Patient',
    communication: [
      {
        language: {
          coding: [
            {
              code: 'en',
              system: 'urn:ietf:bcp:47',
              display: 'English',
            },
          ],
        },
        preferred: true,
      },
    ],
    ...base,
  };
  return patient;
};

interface PersistTestPatientInput {
  patient: Patient;
  processId: string;
}
export const persistTestPatient = async (input: PersistTestPatientInput, oystehr: Oystehr): Promise<Patient> => {
  const { patient, processId } = input;
  const resource = {
    ...patient,
    id: undefined,
    meta: {
      tag: [
        {
          system: 'OTTEHR_AUTOMATED_TEST',
          code: tagForProcessId(processId),
          display: 'a test resource that should be cleaned up',
        },
      ],
    },
  };
  try {
    const createdPatient = await oystehr.fhir.create<Patient>(resource);
    console.log('createdPatient', createdPatient);
    await oystehr.fhir.create<RelatedPerson>({
      resourceType: 'RelatedPerson',
      patient: { reference: `Patient/${createdPatient.id}` },
      name: [
        {
          family: 'Horseman',
          // cSpell:disable-next Bojack
          given: ['Bojack'],
        },
      ],
      telecom: [
        {
          system: 'phone',
          value: '+12027139680',
          use: 'mobile',
        },
      ],
    });
    return createdPatient;
  } catch (error) {
    console.error('Error creating test patient', error);
    throw new Error('Error creating test patient');
  }
};
