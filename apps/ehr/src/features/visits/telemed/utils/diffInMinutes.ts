import { DateTime } from 'luxon';

export const diffInMinutes = (laterDate: DateTime, earlierDate: DateTime): number =>
  Math.round(laterDate.diff(earlierDate, 'minutes').minutes);
