import { useMemo } from 'react';
import { AvailableLocationInformation, CheckOfficeOpenOutput } from 'utils';

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
    return {
      officeOpen: true,
      walkinOpen: true,
      officeHasClosureOverrideToday: false,
      officeHasClosureOverrideTomorrow: false,
      prebookStillOpenForToday: true,
    };
  }, [selectedLocation]);
};
