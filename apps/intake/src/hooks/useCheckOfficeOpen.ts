import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { AvailableLocationInformation } from 'utils';
import { isClosureOverride, getOpeningTime, getClosingTime, isWalkinOpen } from 'utils';

interface CheckOfficeOpenOutput {
  officeOpen: boolean;
  walkinOpen: boolean;
  prebookStillOpenForToday: boolean;
  officeHasClosureOverrideToday: boolean;
  officeHasClosureOverrideTomorrow: boolean;
}

export const useCheckOfficeOpen = (
  selectedLocation: AvailableLocationInformation | undefined
): CheckOfficeOpenOutput => {
  return useMemo(() => {
    if (!selectedLocation) {
      // console.log('no selected location, office closed');
      return {
        officeOpen: false,
        walkinOpen: false,
        officeHasClosureOverrideToday: false,
        officeHasClosureOverrideTomorrow: false,
        prebookStillOpenForToday: false,
      };
    }

    const timeNow = DateTime.now().setZone(selectedLocation.timezone);
    const tomorrowDate = timeNow.plus({ days: 1 });
    const tomorrowOpeningTime = getOpeningTime(selectedLocation, tomorrowDate);

    const officeHasClosureOverrideToday = isClosureOverride(selectedLocation, timeNow);
    const officeHasClosureOverrideTomorrow =
      isClosureOverride(selectedLocation, tomorrowDate) && tomorrowOpeningTime !== undefined;

    const todayOpeningTime = getOpeningTime(selectedLocation, timeNow);
    const todayClosingTime = getClosingTime(selectedLocation, timeNow);

    const prebookStillOpenForToday =
      todayOpeningTime !== undefined &&
      (todayClosingTime === undefined || todayClosingTime > timeNow.plus({ hours: 1 }));

    const officeOpen =
      todayOpeningTime !== undefined &&
      todayOpeningTime <= timeNow &&
      (todayClosingTime === undefined || todayClosingTime > timeNow) &&
      !officeHasClosureOverrideToday;

    const walkinOpen = isWalkinOpen(selectedLocation, timeNow);

    console.log(
      'officeOpen, walkinOpen, prebookStillOpenForToday, officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow',
      officeOpen,
      walkinOpen,
      prebookStillOpenForToday,
      officeHasClosureOverrideToday,
      officeHasClosureOverrideTomorrow
    );

    return {
      officeOpen,
      walkinOpen,
      officeHasClosureOverrideTomorrow,
      officeHasClosureOverrideToday,
      prebookStillOpenForToday,
    };
  }, [selectedLocation]);
};
