import { DateTime } from 'luxon';
import { Closure, OVERRIDE_DATE_FORMAT, Timezone } from '../types/common';
import { applyOverridesToDailySchedule, DOW, ScheduleDay, ScheduleExtension } from '../utils';

export function isClosureOverride(closures: Closure[], timezone: Timezone, currentDate: DateTime): boolean {
  const result = closures.some((closure) => {
    const { start, end } = closure;
    const closureStart = DateTime.fromFormat(start, OVERRIDE_DATE_FORMAT, { zone: timezone });
    if (closureStart.ordinal === currentDate.ordinal) {
      return true;
    } else if (end) {
      const closureEnd = DateTime.fromFormat(end, OVERRIDE_DATE_FORMAT, { zone: timezone });
      return currentDate.ordinal >= closureStart.ordinal && currentDate.ordinal <= closureEnd.ordinal;
    }
    return false;
  });
  return result;
}

export function getOpeningTime(
  scheduleDef: ScheduleExtension,
  timezone: Timezone,
  currentDate: DateTime
): DateTime | undefined {
  // get the overridden values for the current date, if any, else get the default values for the current DOW
  const currentHoursOfOperation =
    applyOverridesToDailySchedule({
      dailySchedule: scheduleDef.schedule,
      timezone,
      from: currentDate,
      scheduleOverrides: scheduleDef.scheduleOverrides,
    })?.overriddenDay ?? getHoursForDate(scheduleDef, currentDate);
  console.log('currentHoursOfOperation', currentHoursOfOperation);
  if (!currentHoursOfOperation) {
    return undefined;
  }
  const dt = DateTime.now().setZone(timezone).startOf('day').plus({ hours: currentHoursOfOperation.open });
  return dt.set({
    year: currentDate.year,
    month: currentDate.month,
    day: currentDate.day,
  });
}

export function getClosingTime(
  scheduleDef: ScheduleExtension,
  timezone: Timezone,
  currentDate: DateTime
): DateTime | undefined {
  // get the overridden values for the current date, if any, else get the default values for the current DOW
  const currentHoursOfOperation =
    applyOverridesToDailySchedule({
      dailySchedule: scheduleDef.schedule,
      timezone,
      from: currentDate,
      scheduleOverrides: scheduleDef.scheduleOverrides,
    })?.overriddenDay ?? getHoursForDate(scheduleDef, currentDate);

  if (!currentHoursOfOperation) {
    return undefined;
  }
  const dt = DateTime.now().setZone(timezone).startOf('day').plus({ hours: currentHoursOfOperation.close });
  const formattedClosingTime = dt.set({
    year: currentDate.year,
    month: currentDate.month,
    day: currentDate.day,
  });
  // if time is midnight, add 1 day to closing time
  if (
    formattedClosingTime !== undefined &&
    formattedClosingTime.hour === 0 &&
    formattedClosingTime.minute === 0 &&
    formattedClosingTime.second === 0
  ) {
    return formattedClosingTime.plus({ day: 1 });
  }
  return formattedClosingTime;
}

export function getHoursForDate(scheduleDef: ScheduleExtension, currentDate: DateTime): ScheduleDay | undefined {
  const weekdayLong = currentDate.toLocaleString({ weekday: 'long' }, { locale: 'en-US' }).toLowerCase() as DOW;
  const scheduleDays = scheduleDef.schedule;
  return scheduleDays[weekdayLong];
}

export function isWalkinOpen(scheduleDef: ScheduleExtension, timezone: Timezone, timeNow: DateTime): boolean {
  const officeHasClosureOverrideToday = isClosureOverride(scheduleDef.closures ?? [], timezone, timeNow);
  const todayOpeningTime = getOpeningTime(scheduleDef, timezone, timeNow);
  const todayClosingTime = getClosingTime(scheduleDef, timezone, timeNow);
  return (
    todayOpeningTime !== undefined &&
    todayOpeningTime.minus({ minute: 0 }) <= timeNow && // todo: move this onto the schedule json
    (todayClosingTime === undefined || todayClosingTime > timeNow) &&
    !officeHasClosureOverrideToday
  );
}

export function isLocationOpen(scheduleDef: ScheduleExtension, timezone: Timezone, now: DateTime): boolean {
  const nextOpeningDateTime = getOpeningTime(scheduleDef, timezone, now);
  return (
    nextOpeningDateTime !== undefined && !isClosureOverride(scheduleDef.closures ?? [], timezone, nextOpeningDateTime)
  );
}
