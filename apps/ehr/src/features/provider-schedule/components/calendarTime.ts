import { DateTime } from 'luxon';

/**
 * FullCalendar v5 can only render named timezones with its luxon2 plugin, which conflicts with
 * the repo's luxon 3. Instead the calendars run with `timeZone="UTC"` and are fed "floating"
 * wall-clock strings in the provider's timezone, so 08:00 at the clinic renders as 08:00 no
 * matter where the viewer's browser is. These helpers convert at that boundary.
 */

/** ISO with offset → floating "yyyy-MM-ddTHH:mm:ss" in the instant's own (provider) offset. */
export const toFloating = (iso: string): string =>
  DateTime.fromISO(iso, { setZone: true }).toFormat("yyyy-LL-dd'T'HH:mm:ss");

/** A Date that FullCalendar produced in UTC mode → the same wall time in `timezone`. */
export const fromFloating = (date: Date, timezone: string): DateTime =>
  DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone, { keepLocalTime: true });

/** Floating calendar date (yyyy-MM-dd) of a FullCalendar Date in UTC mode. */
export const floatingDate = (date: Date): string => DateTime.fromJSDate(date, { zone: 'utc' }).toISODate()!;

/** "Now" at the provider's location, as a floating string for FullCalendar's `now` prop. */
export const nowFloating = (timezone: string): string =>
  DateTime.now().setZone(timezone).toFormat("yyyy-LL-dd'T'HH:mm:ss");

export const todayIn = (timezone: string): string => DateTime.now().setZone(timezone).toISODate()!;

export const formatTimeRange = (startIso: string, endIso: string): string => {
  const start = DateTime.fromISO(startIso, { setZone: true });
  const end = DateTime.fromISO(endIso, { setZone: true });
  return `${start.toFormat('h:mm')}–${end.toFormat('h:mm a')}`;
};

/** Hex color + alpha → rgba(), for tinted block backgrounds. */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
