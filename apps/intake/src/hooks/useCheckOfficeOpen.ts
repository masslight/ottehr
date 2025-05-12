import { useMemo } from 'react';
import { AvailableLocationInformation, checkOfficeOpen, CheckOfficeOpenOutput } from 'utils';

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
    const { officeOpen, prebookStillOpenForToday, officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow } =
      checkOfficeOpen(selectedLocation);

    /*
    const walkinOpen = isWalkinOpen(selectedLocation, timeNow);

    console.log(
      'officeOpen, walkinOpen, prebookStillOpenForToday, officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow',
      officeOpen,
      walkinOpen,
      prebookStillOpenForToday,
      officeHasClosureOverrideToday,
      officeHasClosureOverrideTomorrow
    );
    */

    return {
      officeOpen,
      walkinOpen: true, // hardcoding walking open for now. up for refactor in next cycle: https://github.com/masslight/ottehr/issues/1871
      officeHasClosureOverrideTomorrow,
      officeHasClosureOverrideToday,
      prebookStillOpenForToday,
    };
  }, [selectedLocation]);
};
