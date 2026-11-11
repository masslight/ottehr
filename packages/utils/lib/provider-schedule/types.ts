/**
 * Provider schedule templates for primary care.
 *
 * The existing Schedule extension (`ScheduleExtension` in utils/scheduleUtils) models
 * hourly capacity per weekday — a good fit for walk-in / urgent care, where the question
 * is "how many patients can we see this hour". Primary care schedules are instead built
 * from named blocks of time, each reserved for particular visit types, with slot lengths
 * that vary by visit type and by provider (a new-patient physical may be 40 minutes for
 * one provider and 60 for another).
 *
 * These types describe that model. Times inside a template are wall-clock times in the
 * provider's timezone ("HH:mm"); expansion into concrete dated instances happens in
 * `expand.ts`.
 */

/** ISO weekday, Monday = 1 … Sunday = 7 (matches luxon's `DateTime.weekday`). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Wall-clock time of day, 24h "HH:mm". */
export type TimeOfDay = string;

/** Calendar date, "yyyy-MM-dd". */
export type IsoDate = string;

/**
 * A kind of visit that can be booked into a block. In the persisted model this maps to a
 * service category (HealthcareService) — `serviceCategoryCode` is that code, and
 * `defaultDurationMinutes` mirrors the category's configured duration.
 */
export interface ScheduleVisitType {
  id: string;
  name: string;
  serviceCategoryCode: string;
  defaultDurationMinutes: number;
  /** Display color for calendar events (hex). */
  color: string;
}

/** Per-provider overrides for a visit type. Absent entry = enabled with the default duration. */
export interface ProviderVisitTypeSetting {
  visitTypeId: string;
  enabled: boolean;
  /** Overrides `ScheduleVisitType.defaultDurationMinutes` for this provider. */
  durationMinutes?: number;
  /** Optional cap on how many of this visit type the provider sees per day. */
  maxPerDay?: number;
}

export type BlockKind = 'bookable' | 'unavailable';

export const UNAVAILABLE_REASONS = ['lunch', 'admin', 'meeting', 'huddle', 'other'] as const;
export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

export interface TemplateBlock {
  id: string;
  weekday: IsoWeekday;
  /** 1-based week within the template's cycle. Always 1 for single-week templates. */
  cycleWeek: number;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  kind: BlockKind;
  /** Shown on the calendar, e.g. "New patients", "Same-day sick", "Lunch". */
  label: string;
  /** Bookable blocks only. Empty = any visit type the provider has enabled. */
  visitTypeIds: string[];
  /** Unavailable blocks only. */
  reason?: UnavailableReason;
}

/**
 * A repeating weekly (or multi-week) pattern for one provider at one location. A provider
 * can have several templates over time (e.g. a summer schedule); the one whose effective
 * range covers a date applies, with the latest `effectiveFrom` winning ties.
 */
export interface ProviderScheduleTemplate {
  id: string;
  name: string;
  locationId: string;
  effectiveFrom: IsoDate;
  /** Inclusive. Open-ended when absent. */
  effectiveTo?: IsoDate;
  /** Length of the repeating cycle in weeks (1 = every week, 2 = alternating weeks…). */
  cycleWeeks: number;
  blocks: TemplateBlock[];
}

/**
 * A one-off change on a specific date: time off (all-day or partial), or an extra bookable
 * block. Exceptions are applied on top of the template for that date.
 */
export interface ScheduleException {
  id: string;
  date: IsoDate;
  kind: BlockKind;
  label: string;
  /** Both absent = all day. */
  startTime?: TimeOfDay;
  endTime?: TimeOfDay;
  visitTypeIds: string[];
  reason?: UnavailableReason;
}

export interface ProviderScheduleConfig {
  providerId: string;
  timezone: string;
  visitTypeSettings: ProviderVisitTypeSetting[];
  templates: ProviderScheduleTemplate[];
  exceptions: ScheduleException[];
}

/** A block placed on a specific date, after template selection and exceptions. */
export interface ScheduleBlockInstance {
  /** Stable within an expansion: `${sourceId}:${date}` (suffixed when an exception splits a block). */
  key: string;
  date: IsoDate;
  /** ISO datetimes in the provider's timezone. */
  start: string;
  end: string;
  kind: BlockKind;
  label: string;
  visitTypeIds: string[];
  reason?: UnavailableReason;
  source: { type: 'template'; templateId: string; blockId: string } | { type: 'exception'; exceptionId: string };
}

/** A booked appointment as the schedule views need it. */
export interface ScheduledAppointment {
  id: string;
  providerId: string;
  patientName: string;
  visitTypeId: string;
  start: string;
  end: string;
  status: 'booked' | 'arrived' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
}

export interface ScheduleProvider {
  id: string;
  name: string;
  credentials?: string;
  locationIds: string[];
}

export interface ScheduleLocation {
  id: string;
  name: string;
  timezone: string;
}
