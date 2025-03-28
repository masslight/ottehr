import { randomUUID } from 'crypto';
import { Location, LocationHoursOfOperation } from 'fhir/r4b';
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
} from 'utils';

const DAYS_LONG = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
type DayLong = (typeof DAYS_LONG)[number];

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayOfWeek = (typeof DAYS)[number];

// todo: avoid name collision with fhir resource
export interface Schedule {
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
  schedule: Schedule;
  openingBuffer: number;
  closingBuffer: number;
}

export interface OverrideScheduleConfig {
  date: DateTime;
  open: HourOfDay;
  close: HourOfDay;
  openingBuffer: number;
  closingBuffer: number;
  hourlyCapacity: number;
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

export const createGenericSchedule = (open: HourOfDay, close: HourOfDay | 24): Schedule => {
  const schedule: Schedule = {};
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
}: CreateScheduleConfig): Schedule => {
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

export const makeLocation = (schedule: string, operationHours: LocationHoursOfOperation[]): Location => {
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
    extension: [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/timezone',
        valueString: 'America/New_York',
      },
      {
        url: SCHEDULE_EXTENSION_URL,
        valueString: schedule,
      },
    ],
    hoursOfOperation: operationHours,
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

export const replaceSchedule = (location: Location, schedule: ScheduleExtension): Location => {
  const scheduleIdx = location.extension?.findIndex((ext) => ext.url === SCHEDULE_EXTENSION_URL);
  const updatedLocation: Location = { ...location };
  if (scheduleIdx !== undefined && scheduleIdx >= 0 && updatedLocation.extension) {
    updatedLocation.extension[scheduleIdx] = {
      ...updatedLocation.extension[scheduleIdx],
      valueString: JSON.stringify(schedule),
    };
    return updatedLocation;
  } else {
    return location;
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
): Location => {
  let operationHours: LocationHoursOfOperation[] = getGenericHoursOfOperation();
  let schedule: Schedule | undefined;
  hoursInfo.forEach((hoursInfoForDay) => {
    operationHours = editHoursOfOperationForDay(hoursInfoForDay, operationHours);
    schedule = updateScheduleForDay({
      hoursInfo: hoursInfoForDay,
      hourlyCapacity,
      schedule: schedule ?? createGenericSchedule(hoursInfoForDay.open, hoursInfoForDay.close),
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

  if (!schedule) {
    throw new Error('you messed up');
  }

  const scheduleComplete = { schedule, scheduleOverrides, closures };
  const scheduleString = JSON.stringify(scheduleComplete);
  const location = makeLocation(scheduleString, operationHours);
  return location;
};
