import { checkOfficeOpen, TelemedLocation } from 'utils';

export const checkTelemedLocationAvailability = (location?: TelemedLocation): boolean => {
  try {
    if (!location?.available) {
      return false;
    }

    const { officeOpen } = checkOfficeOpen(location.locationInformation);

    return officeOpen;
  } catch {
    console.error('Error during checking state availability');
    return false;
  }
};
