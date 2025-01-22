import { isHoliday, telemedFederalHolidays, TelemedLocation, telemedStateWorkingSchedule } from 'utils';
import { DateTime } from 'luxon';

export const checkTelemedLocationAvailability = (location?: TelemedLocation): boolean => {
  try {
    if (!location?.available) {
      return false;
    }

    const workingSchedule = telemedStateWorkingSchedule[location.state];

    // if the state is enabled in the EHR states list and we don't have static schedule for it - show it as available always
    if (!workingSchedule) {
      return true;
    }

    const timeZone = workingSchedule.timeZone;
    if (!timeZone) return false;

    const now = DateTime.now().setZone(timeZone);
    const dayOfWeek = now.weekday;
    const currentTime = now.hour + now.minute / 60;

    let workingHours;
    const isTodayHoliday = isHoliday(now, telemedFederalHolidays);

    if (isTodayHoliday) {
      workingHours = workingSchedule.holidays;
    } else if (dayOfWeek === 7 || dayOfWeek === 6) {
      workingHours = workingSchedule.weekends;
    } else {
      workingHours = workingSchedule.weekdays;
    }

    if (!workingHours) {
      return false;
    }

    const [startTimeStr, endTimeStr] = workingHours.split(' – ');
    const startTime = Number(DateTime.fromFormat(startTimeStr, 'h a', { zone: timeZone }).toFormat('H'));
    let endTime = Number(DateTime.fromFormat(endTimeStr, 'h a', { zone: timeZone }).toFormat('H'));

    if (endTime === 0) {
      endTime = 24;
    }

    return currentTime >= startTime && currentTime < endTime;
  } catch {
    console.error('Error during checking state availability');
    return false;
  }
};
