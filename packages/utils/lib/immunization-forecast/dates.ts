/**
 * Date arithmetic for the CDSi logic specification (v4.6, section 3.4 "Date calculations").
 * Dates are ISO yyyy-mm-dd strings so they compare with < and > directly.
 */

export type IsoDate = string;

export interface Duration {
  years: number;
  months: number;
  days: number;
}

const DAY_MS = 86_400_000;
const durationCache = new Map<string, Duration>();

/**
 * Parses a CDSi duration such as "6 weeks - 4 days", "3 months + 4 weeks", "16 years - 4 months", "0 days".
 * Weeks are folded into days (CALCDT-3).
 */
export function parseDuration(text: string): Duration {
  const cached = durationCache.get(text);
  if (cached) return cached;
  const d: Duration = { years: 0, months: 0, days: 0 };
  const re = /([+-])?\s*(\d+)\s*(years?|months?|weeks?|days?)/gi;
  let matched = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matched += m[0].length;
    const sign = m[1] === '-' ? -1 : 1;
    const n = sign * Number(m[2]);
    const unit = m[3].toLowerCase();
    if (unit.startsWith('year')) d.years += n;
    else if (unit.startsWith('month')) d.months += n;
    else if (unit.startsWith('week')) d.days += n * 7;
    else d.days += n;
  }
  if (matched === 0 || text.replace(/[+\-\s\d]|years?|months?|weeks?|days?/gi, '').length > 0) {
    throw new Error(`Cannot parse CDSi duration "${text}"`);
  }
  durationCache.set(text, d);
  return d;
}

function split(iso: IsoDate): { y: number; m: number; d: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Not an ISO date: "${iso}"`);
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) };
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * date + duration per CALCDT-1..6: years first, then months (keeping the day), then days.
 * A day that does not exist in the resulting month moves forward to the first of the next month (CALCDT-5).
 */
export function addDuration(iso: IsoDate, duration: Duration | string): IsoDate {
  const dur = typeof duration === 'string' ? parseDuration(duration) : duration;
  const { y, m, d } = split(iso);
  let year = y + dur.years;
  let month = m + dur.months;
  year += Math.floor((month - 1) / 12);
  month = ((((month - 1) % 12) + 12) % 12) + 1;
  let day = d;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return fromUtcMs(Date.UTC(year, month - 1, day) + dur.days * DAY_MS);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const { y, m, d } = split(iso);
  return fromUtcMs(Date.UTC(y, m - 1, d) + days * DAY_MS);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = split(from);
  const b = split(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function maxDate(...dates: (IsoDate | undefined | null)[]): IsoDate | undefined {
  let best: IsoDate | undefined;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

export function minDate(...dates: (IsoDate | undefined | null)[]): IsoDate | undefined {
  let best: IsoDate | undefined;
  for (const d of dates) if (d && (!best || d < best)) best = d;
  return best;
}

/** Whole years of age on `on`, for the self-report rule and series-group picking. */
export function ageInYears(dob: IsoDate, on: IsoDate): number {
  let years = 0;
  while (addDuration(dob, { years: years + 1, months: 0, days: 0 }) <= on) years++;
  return years;
}
