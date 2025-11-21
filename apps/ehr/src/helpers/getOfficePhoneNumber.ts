import { Location } from 'fhir/r4b';
import { standardizePhoneNumber } from 'utils';

const PLACEHOLDER_PHONE_NUMBER = '[office phone number]';

export const getOfficePhoneNumber = (location: Location | undefined): string => {
  let locationToUse = location;
  if (locationToUse === undefined) {
    const storedLoc = localStorage.getItem('selectedLocation');
    if (storedLoc) {
      try {
        locationToUse = JSON.parse(storedLoc) as Location;
      } catch {
        console.error('location could not be parsed from local storage');
      }
    }
  }

  try {
    if (!locationToUse || typeof locationToUse !== 'object' || locationToUse.resourceType !== 'Location') {
      return PLACEHOLDER_PHONE_NUMBER;
    }

    const officePhoneNumber = locationToUse?.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value;
    return standardizePhoneNumber(officePhoneNumber) ?? PLACEHOLDER_PHONE_NUMBER;
  } catch (error) {
    console.error('Error parsing location from storage:', error);
    return PLACEHOLDER_PHONE_NUMBER;
  }
};
