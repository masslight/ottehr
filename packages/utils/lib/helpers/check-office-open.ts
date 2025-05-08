import { LocationHoursOfOperation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { AvailableLocationInformation, HOURS_OF_OPERATION_FORMAT, OVERRIDE_DATE_FORMAT } from '../types/common';

export function isClosureOverride(
  selectedLocation: Pick<AvailableLocationInformation, 'closures' | 'timezone'>,
  currentDate: DateTime
): boolean {
  const closures = selectedLocation.closures ?? [];
  const result = closures.some((closure) => {
    const { start, end } = closure;
    const closureStart = DateTime.fromFormat(start, OVERRIDE_DATE_FORMAT, { zone: selectedLocation.timezone });
    if (closureStart.ordinal === currentDate.ordinal) {
      return true;
    } else if (end) {
      const closureEnd = DateTime.fromFormat(end, OVERRIDE_DATE_FORMAT, { zone: selectedLocation.timezone });
      return currentDate.ordinal >= closureStart.ordinal && currentDate.ordinal <= closureEnd.ordinal;
    }
    return false;
  });
  return result;
}

export function getOpeningTime(
  selectedLocation: Pick<AvailableLocationInformation, 'hoursOfOperation' | 'timezone'>,
  currentDate: DateTime
): DateTime | undefined {
  const currentHoursOfOperation = getCurrentHoursOfOperation(selectedLocation, currentDate);
  return currentHoursOfOperation?.openingTime
    ? DateTime.fromFormat(currentHoursOfOperation?.openingTime, HOURS_OF_OPERATION_FORMAT, {
        zone: selectedLocation.timezone,
      }).set({
        year: currentDate.year,
        month: currentDate.month,
        day: currentDate.day,
      })
    : undefined;
}

export function getClosingTime(
  selectedLocation: Pick<AvailableLocationInformation, 'hoursOfOperation' | 'timezone'>,
  currentDate: DateTime
): DateTime | undefined {
  const currentHoursOfOperation = getCurrentHoursOfOperation(selectedLocation, currentDate);
  const formattedClosingTime = currentHoursOfOperation?.closingTime
    ? DateTime.fromFormat(currentHoursOfOperation?.closingTime, HOURS_OF_OPERATION_FORMAT, {
        zone: selectedLocation.timezone,
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
  selectedLocation: Pick<AvailableLocationInformation, 'hoursOfOperation' | 'timezone'>,
  currentDate: DateTime
): LocationHoursOfOperation | undefined {
  const weekdayShort = currentDate.toLocaleString({ weekday: 'short' }, { locale: 'en-US' }).toLowerCase();
  return selectedLocation?.hoursOfOperation?.find((item) => {
    return item.daysOfWeek?.[0] === weekdayShort;
  });
}

export function isWalkinOpen(
  selectedLocation: Pick<AvailableLocationInformation, 'hoursOfOperation' | 'timezone' | 'closures'>,
  timeNow: DateTime
): boolean {
  const officeHasClosureOverrideToday = isClosureOverride(selectedLocation, timeNow);
  const todayOpeningTime = getOpeningTime(selectedLocation, timeNow);
  const todayClosingTime = getClosingTime(selectedLocation, timeNow);
  return (
    todayOpeningTime !== undefined &&
    todayOpeningTime.minus({ minute: 15 }) <= timeNow &&
    (todayClosingTime === undefined || todayClosingTime > timeNow) &&
    !officeHasClosureOverrideToday
  );
}

export function isLocationOpen(
  selectedLocation: Pick<AvailableLocationInformation, 'hoursOfOperation' | 'timezone' | 'closures'>,
  now: DateTime
): boolean {
  const nextOpeningDateTime = getOpeningTime(selectedLocation, now);
  return nextOpeningDateTime !== undefined && !isClosureOverride(selectedLocation, nextOpeningDateTime);
}
