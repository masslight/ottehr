import { DateTime } from 'luxon';
import { isLocationOpen, TelemedLocation } from 'utils';

// todo: does there need to be a separate telemed implementation for this?
export const checkTelemedLocationAvailability = (location?: TelemedLocation): boolean => {
  try {
    if (!location?.available) {
      return false;
    }

    const scheduleExtension = location.locationInformation.scheduleExtension;
    const timezone = location.locationInformation.timezone;
    if (!scheduleExtension || !timezone) {
      throw new Error('Schedule extension is not available');
    }
    const officeOpen = isLocationOpen(scheduleExtension, timezone, DateTime.now());

    return officeOpen;
  } catch {
    console.error('Error during checking state availability');
    return false;
  }
};
