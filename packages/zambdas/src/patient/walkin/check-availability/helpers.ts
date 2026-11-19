import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isLocationBookable } from 'utils/lib/fhir/location';
import { getClosingTime, getOpeningTime, isClosureOverride } from 'utils/lib/helpers/check-office-open';
import { WalkinAvailabilityCheckResult } from 'utils/lib/types/api/appointment.types';
import { ScheduleOwnerFhirResource } from 'utils/lib/types/api/schedules';
import { Closure, Timezone } from 'utils/lib/types/common';
import { ScheduleExtension } from 'utils/lib/utils/scheduleUtils';

export type WalkinAvailability = Pick<
  WalkinAvailabilityCheckResult,
  | 'officeOpen'
  | 'walkinOpen'
  | 'prebookStillOpenForToday'
  | 'officeHasClosureOverrideToday'
  | 'officeHasClosureOverrideTomorrow'
>;

interface ComputeWalkinAvailabilityInput {
  scheduleExtension: ScheduleExtension;
  timezone: Timezone;
  timeNow: DateTime;
  scheduleOwner?: ScheduleOwnerFhirResource;
}

export const computeWalkinAvailability = (input: ComputeWalkinAvailabilityInput): WalkinAvailability => {
  const { scheduleExtension, timezone, timeNow, scheduleOwner } = input;
  const tomorrow = timeNow.plus({ days: 1 });
  const todayOpeningTime = getOpeningTime(scheduleExtension, timezone, timeNow);
  const todayClosingTime = getClosingTime(scheduleExtension, timezone, timeNow);

  // todo: consider just sending the closures list and allow the client to check for closure overrides for whichever days
  const officeHasClosureOverrideToday = isClosureOverride(scheduleExtension.closures ?? [], timezone, timeNow);
  const officeHasClosureOverrideTomorrow = isClosureOverride(scheduleExtension.closures ?? [], timezone, tomorrow);

  // A deactivated Location takes no visits, whatever its schedule says.
  if (scheduleOwner?.resourceType === 'Location' && !isLocationBookable(scheduleOwner as Location)) {
    return {
      officeOpen: false,
      walkinOpen: false,
      prebookStillOpenForToday: false,
      officeHasClosureOverrideToday,
      officeHasClosureOverrideTomorrow,
    };
  }

  const prebookStillOpenForToday =
    todayOpeningTime !== undefined && (todayClosingTime === undefined || todayClosingTime > timeNow.plus({ hours: 1 }));

  const officeOpen =
    todayOpeningTime !== undefined &&
    todayOpeningTime <= timeNow &&
    (todayClosingTime === undefined || todayClosingTime > timeNow) &&
    !officeHasClosureOverrideToday;

  const walkinOpen = isWalkinOpen({
    openingTime: todayOpeningTime,
    closingTime: todayClosingTime,
    closures: scheduleExtension.closures ?? [],
    timezone,
    timeNow,
  });

  return {
    officeOpen,
    walkinOpen,
    prebookStillOpenForToday,
    officeHasClosureOverrideToday,
    officeHasClosureOverrideTomorrow,
  };
};

interface CheckWalkinOpenInput {
  openingTime: DateTime | undefined;
  closingTime: DateTime | undefined;
  closures: Closure[];
  timezone: Timezone;
  timeNow: DateTime;
  // this optional prop can be used to allow checking in for a walkin/ad-hoc appointment prior to the opening time
  minutesWalkinAvailableBeforeOpening?: number;
}

function isWalkinOpen(input: CheckWalkinOpenInput): boolean {
  const { openingTime, closingTime, closures, timezone, timeNow, minutesWalkinAvailableBeforeOpening = 0 } = input;
  const officeHasClosureOverrideToday = isClosureOverride(closures, timezone, timeNow);

  return (
    openingTime !== undefined &&
    openingTime.minus({ minute: minutesWalkinAvailableBeforeOpening }) <= timeNow &&
    (closingTime === undefined || closingTime > timeNow) &&
    !officeHasClosureOverrideToday
  );
}
