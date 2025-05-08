import { LocationHoursOfOperation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Closure, HOURS_OF_OPERATION_FORMAT, OVERRIDE_DATE_FORMAT, Timezone } from '../types/common';

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
  hoursOfOperation: LocationHoursOfOperation[],
  timezone: Timezone,
  currentDate: DateTime
): DateTime | undefined {
  const currentHoursOfOperation = getCurrentHoursOfOperation(hoursOfOperation, currentDate);
  console.log('currentHoursOfOperation', currentHoursOfOperation?.openingTime);
  const parsedInt = parseInt(currentHoursOfOperation?.openingTime ?? '');
  if (isNaN(parsedInt)) {
    return undefined;
  }
  const dt = DateTime.now().setZone(timezone).startOf('day').plus({ hours: parsedInt });
  return dt.set({
    year: currentDate.year,
    month: currentDate.month,
    day: currentDate.day,
  });
}

export function getClosingTime(
  hoursOfOperation: LocationHoursOfOperation[],
  timezone: Timezone,
  currentDate: DateTime
): DateTime | undefined {
  const currentHoursOfOperation = getCurrentHoursOfOperation(hoursOfOperation, currentDate);
  const formattedClosingTime = currentHoursOfOperation?.closingTime
    ? DateTime.fromFormat(currentHoursOfOperation?.closingTime, HOURS_OF_OPERATION_FORMAT, {
        zone: timezone,
      }).set({
        year: currentDate.year,
        month: currentDate.month,
        day: currentDate.day,
      })
    : undefined;
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

export function getCurrentHoursOfOperation(
  hoursOfOperation: LocationHoursOfOperation[],
  currentDate: DateTime
): LocationHoursOfOperation | undefined {
  const weekdayShort = currentDate.toLocaleString({ weekday: 'short' }, { locale: 'en-US' }).toLowerCase();
  return hoursOfOperation?.find((item) => {
    return item.daysOfWeek?.[0] === weekdayShort;
  });
}

export function isWalkinOpen(
  hoursOfOperation: LocationHoursOfOperation[],
  timezone: Timezone,
  closures: Closure[],
  timeNow: DateTime
): boolean {
  const officeHasClosureOverrideToday = isClosureOverride(closures, timezone, timeNow);
  const todayOpeningTime = getOpeningTime(hoursOfOperation, timezone, timeNow);
  const todayClosingTime = getClosingTime(hoursOfOperation, timezone, timeNow);
  return (
    todayOpeningTime !== undefined &&
    todayOpeningTime.minus({ minute: 15 }) <= timeNow &&
    (todayClosingTime === undefined || todayClosingTime > timeNow) &&
    !officeHasClosureOverrideToday
  );
}

export function isLocationOpen(
  hoursOfOperation: LocationHoursOfOperation[],
  timezone: Timezone,
  closures: Closure[],
  now: DateTime
): boolean {
  const nextOpeningDateTime = getOpeningTime(hoursOfOperation, timezone, now);
  return nextOpeningDateTime !== undefined && !isClosureOverride(closures, timezone, nextOpeningDateTime);
}
