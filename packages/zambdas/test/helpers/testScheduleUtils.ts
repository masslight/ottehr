import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Location, LocationHoursOfOperation, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  Capacity,
  Closure,
  DailySchedule,
  DOW,
  HourOfDay,
  OVERRIDE_DATE_FORMAT,
  FHIR_BASE_URL,
  ScheduleExtension,
  ScheduleOverrides,
  SLUG_SYSTEM,
  SCHEDULE_EXTENSION_URL,
  ClosureType,
  ScheduleDay,
} from 'utils';

const DAYS_LONG = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
type DayLong = (typeof DAYS_LONG)[number];

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayOfWeek = (typeof DAYS)[number];

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
  return `${DELETABLE_RESOURCE_CODE_PREFIX}${processId ?? 'N/A'}`;
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
  const { openingBuffer, closingBuffer } = bufferDef;
  const schedule = scheduleExt.schedule;

  const updatedEntries = Object.entries(schedule).map(([day, daySchedule]) => {
    const newOpeningBuffer = openingBuffer ?? daySchedule.openingBuffer;
    const newClosingBuffer = closingBuffer ?? daySchedule.closingBuffer;

    return [day, { ...daySchedule, openingBuffer: newOpeningBuffer, closingBuffer: newClosingBuffer }];
  });
  const scheduleNew = Object.fromEntries(updatedEntries) as ScheduleExtension['schedule'];
  return {
    ...scheduleExt,
    schedule: scheduleNew,
  };
};

export const changeAllCapacities = (scheduleExt: ScheduleExtension, newCapacity: number): ScheduleExtension => {
  const schedule = scheduleExt.schedule;

  const updatedEntries = Object.entries(schedule).map(([day, daySchedule]) => {
    const { hours } = daySchedule;
    const updatedHours = hours.map((hourObj) => {
      return { ...hourObj, capacity: newCapacity };
    });
    return [day, { ...daySchedule, hours: updatedHours }];
  });
  const scheduleNew = Object.fromEntries(updatedEntries) as ScheduleExtension['schedule'];
  return {
    ...scheduleExt,
    schedule: scheduleNew,
  };
};

export const setSlotLengthInMinutes = (scheduleExt: ScheduleExtension, slotLength: number): ScheduleExtension => {
  return {
    ...scheduleExt,
    slotLength,
  };
};

export const addClosurePeriod = (
  schedule: ScheduleExtension,
  start: DateTime,
  lengthInDays: number
): ScheduleExtension => {
  const closure: Closure = {
    type: ClosureType.Period,
    start: start.toFormat(OVERRIDE_DATE_FORMAT),
    end: start.plus({ days: lengthInDays }).toFormat(OVERRIDE_DATE_FORMAT),
  };
  console.log('closure: ', closure);
  return {
    ...schedule,
    closures: [...(schedule.closures ?? []), closure],
  };
};

export const addClosureDay = (schedule: ScheduleExtension, start: DateTime): ScheduleExtension => {
  const closure: Closure = {
    type: ClosureType.OneDay,
    start: start.toFormat(OVERRIDE_DATE_FORMAT),
    end: start.toFormat(OVERRIDE_DATE_FORMAT),
  };
  console.log('closure: ', closure);
  return {
    ...schedule,
    closures: [...(schedule.closures ?? []), closure],
  };
};

export const addOverrides = (
  scheduleExt: ScheduleExtension,
  overrides: OverrideScheduleConfig[]
): ScheduleExtension => {
  const overridesToAdd: ScheduleOverrides = {};

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
    ...scheduleExt,
    scheduleOverrides: {
      ...(scheduleExt.scheduleOverrides || {}),
      ...overridesToAdd,
    },
  };
};

export const adjustHoursOfOperation = (
  scheduleExt: ScheduleExtension,
  hoursOfOp: HoursOfOpConfig[]
): ScheduleExtension => {
  const schedule = scheduleExt.schedule;

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
    ...scheduleExt,
    schedule: scheduleNew,
  };
};

export const persistSchedule = async (
  scheduleExtension: ScheduleExtension,
  processId: string | null,
  oystehr: Oystehr
): Promise<Schedule> => {
  if (processId === null) {
    throw new Error('processId is null');
  }
  const resource = {
    ...makeSchedule({
      processId,
      scheduleObject: scheduleExtension,
    }),
    id: undefined,
  };

  const schedule = await oystehr.fhir.create<Schedule>(resource);
  return schedule;
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

  const deleteRequests: BatchInputDeleteRequest[] = schedulesAndSuch.map((res) => {
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
