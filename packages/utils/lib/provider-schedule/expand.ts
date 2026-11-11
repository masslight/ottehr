import { DateTime } from 'luxon';
import {
  IsoDate,
  ProviderScheduleConfig,
  ProviderScheduleTemplate,
  ScheduleBlockInstance,
  ScheduledAppointment,
  ScheduleException,
  ScheduleVisitType,
  TemplateBlock,
  TimeOfDay,
} from './types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidTimeOfDay = (value: string): boolean => TIME_PATTERN.test(value) || value === '24:00';

/** Minutes since midnight for "HH:mm" (accepts "24:00" as end-of-day). */
export const timeToMinutes = (time: TimeOfDay): number => {
  if (time === '24:00') return 24 * 60;
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error(`Invalid time of day: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
};

export const minutesToTime = (minutes: number): TimeOfDay => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * The template that governs `date`, or undefined if none is in effect. When effective
 * ranges overlap, the template with the latest `effectiveFrom` wins — so adding a new
 * template starting next month supersedes the old one without editing it.
 */
export const templateForDate = (
  templates: ProviderScheduleTemplate[],
  date: IsoDate
): ProviderScheduleTemplate | undefined =>
  templates
    .filter((t) => t.effectiveFrom <= date && (t.effectiveTo === undefined || date <= t.effectiveTo))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

/**
 * Which week of the template's cycle `date` falls in (1-based). Weeks start on Monday and
 * are counted from the week containing `effectiveFrom`.
 */
export const cycleWeekForDate = (template: ProviderScheduleTemplate, date: IsoDate): number => {
  const cycle = Math.max(1, Math.floor(template.cycleWeeks));
  if (cycle === 1) return 1;
  const anchor = DateTime.fromISO(template.effectiveFrom, { zone: 'utc' }).startOf('week');
  const target = DateTime.fromISO(date, { zone: 'utc' }).startOf('week');
  const weeks = Math.round(target.diff(anchor, 'weeks').weeks);
  return (((weeks % cycle) + cycle) % cycle) + 1;
};

interface MinuteRange {
  start: number;
  end: number;
}

/** `range` minus every range in `cuts`, as zero or more non-empty ranges in order. */
export const subtractRanges = (range: MinuteRange, cuts: MinuteRange[]): MinuteRange[] => {
  let pieces: MinuteRange[] = [range];
  for (const cut of cuts) {
    pieces = pieces.flatMap((piece) => {
      if (cut.end <= piece.start || cut.start >= piece.end) return [piece];
      const out: MinuteRange[] = [];
      if (cut.start > piece.start) out.push({ start: piece.start, end: cut.start });
      if (cut.end < piece.end) out.push({ start: cut.end, end: piece.end });
      return out;
    });
  }
  return pieces;
};

const exceptionRange = (exception: ScheduleException): MinuteRange =>
  exception.startTime && exception.endTime
    ? { start: timeToMinutes(exception.startTime), end: timeToMinutes(exception.endTime) }
    : { start: 0, end: 24 * 60 };

const toIso = (date: IsoDate, minutes: number, timezone: string): string =>
  DateTime.fromISO(date, { zone: timezone }).startOf('day').plus({ minutes }).toISO({ suppressMilliseconds: true })!;

interface DraftInstance {
  range: MinuteRange;
  kind: TemplateBlock['kind'];
  label: string;
  visitTypeIds: string[];
  reason?: TemplateBlock['reason'];
  source: ScheduleBlockInstance['source'];
  keyBase: string;
}

/**
 * Concrete blocks for one provider over [startDate, endDate] (inclusive), in the provider's
 * timezone.
 *
 * For each date: pick the governing template and its blocks for that weekday and cycle week,
 * then apply that date's exceptions. Unavailable exceptions carve time out of template
 * blocks (an all-day one removes them entirely) and are themselves emitted so the calendar
 * can show why the time is gone; bookable exceptions are added as extra blocks.
 */
export const expandProviderSchedule = (
  config: ProviderScheduleConfig,
  startDate: IsoDate,
  endDate: IsoDate
): ScheduleBlockInstance[] => {
  const { timezone } = config;
  const out: ScheduleBlockInstance[] = [];
  let cursor = DateTime.fromISO(startDate, { zone: 'utc' });
  const last = DateTime.fromISO(endDate, { zone: 'utc' });

  while (cursor <= last) {
    const date = cursor.toISODate()!;
    const weekday = cursor.weekday;
    const template = templateForDate(config.templates, date);
    const drafts: DraftInstance[] = [];

    if (template) {
      const week = cycleWeekForDate(template, date);
      for (const block of template.blocks) {
        if (block.weekday !== weekday || block.cycleWeek !== week) continue;
        drafts.push({
          range: { start: timeToMinutes(block.startTime), end: timeToMinutes(block.endTime) },
          kind: block.kind,
          label: block.label,
          visitTypeIds: block.visitTypeIds,
          reason: block.reason,
          source: { type: 'template', templateId: template.id, blockId: block.id },
          keyBase: `${block.id}:${date}`,
        });
      }
    }

    const exceptions = config.exceptions.filter((e) => e.date === date);
    const cuts = exceptions.filter((e) => e.kind === 'unavailable').map(exceptionRange);

    for (const draft of drafts) {
      const pieces = subtractRanges(draft.range, cuts);
      pieces.forEach((piece, i) => {
        out.push(
          finalize(
            { ...draft, range: piece, keyBase: pieces.length > 1 ? `${draft.keyBase}#${i}` : draft.keyBase },
            date
          )
        );
      });
    }

    for (const exception of exceptions) {
      out.push(
        finalize(
          {
            range: exceptionRange(exception),
            kind: exception.kind,
            label: exception.label,
            visitTypeIds: exception.visitTypeIds,
            reason: exception.reason,
            source: { type: 'exception', exceptionId: exception.id },
            keyBase: `${exception.id}:${date}`,
          },
          date
        )
      );
    }

    cursor = cursor.plus({ days: 1 });
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));

  function finalize(draft: DraftInstance, date: IsoDate): ScheduleBlockInstance {
    return {
      key: draft.keyBase,
      date,
      start: toIso(date, draft.range.start, timezone),
      end: toIso(date, draft.range.end, timezone),
      kind: draft.kind,
      label: draft.label,
      visitTypeIds: draft.visitTypeIds,
      reason: draft.reason,
      source: draft.source,
    };
  }
};

/** Visit types the provider offers, with their effective (possibly overridden) durations. */
export const effectiveVisitTypes = (
  config: Pick<ProviderScheduleConfig, 'visitTypeSettings'>,
  visitTypes: ScheduleVisitType[]
): Array<ScheduleVisitType & { durationMinutes: number; maxPerDay?: number }> =>
  visitTypes.flatMap((vt) => {
    const setting = config.visitTypeSettings.find((s) => s.visitTypeId === vt.id);
    if (setting && !setting.enabled) return [];
    return [
      {
        ...vt,
        durationMinutes: setting?.durationMinutes ?? vt.defaultDurationMinutes,
        maxPerDay: setting?.maxPerDay,
      },
    ];
  });

/** Visit types bookable in `block`: its explicit list (minus disabled ones), or all enabled. */
export const bookableVisitTypeIds = (
  block: Pick<ScheduleBlockInstance, 'kind' | 'visitTypeIds'>,
  enabledVisitTypeIds: string[]
): string[] => {
  if (block.kind !== 'bookable') return [];
  if (block.visitTypeIds.length === 0) return enabledVisitTypeIds;
  return block.visitTypeIds.filter((id) => enabledVisitTypeIds.includes(id));
};

/** How many back-to-back visits of `durationMinutes` fit in a block of `blockMinutes`. */
export const slotsThatFit = (blockMinutes: number, durationMinutes: number): number =>
  durationMinutes > 0 ? Math.max(0, Math.floor(blockMinutes / durationMinutes)) : 0;

export interface OpenTime {
  /** Unbooked minutes across bookable blocks. */
  openMinutes: number;
  bookedMinutes: number;
  /** For each enabled visit type: how many more could still be booked, if booked alone. */
  openSlotsByVisitType: Record<string, number>;
}

/**
 * Remaining capacity for one day. Each bookable block's free intervals (block minus
 * overlapping non-cancelled appointments) are counted per visit type the block allows,
 * then capped by any `maxPerDay` minus what's already booked of that type.
 */
export const openTimeForDay = (
  blocks: ScheduleBlockInstance[],
  appointments: ScheduledAppointment[],
  visitTypes: Array<ScheduleVisitType & { durationMinutes: number; maxPerDay?: number }>
): OpenTime => {
  const enabledIds = visitTypes.map((v) => v.id);
  const active = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no-show');
  const toMs = (iso: string): number => DateTime.fromISO(iso).toMillis();
  const result: OpenTime = { openMinutes: 0, bookedMinutes: 0, openSlotsByVisitType: {} };
  enabledIds.forEach((id) => (result.openSlotsByVisitType[id] = 0));

  for (const block of blocks) {
    if (block.kind !== 'bookable') continue;
    const range = { start: toMs(block.start), end: toMs(block.end) };
    const cuts = active.map((a) => ({ start: toMs(a.start), end: toMs(a.end) }));
    const free = subtractRanges(range, cuts);
    const freeMinutes = free.reduce((sum, r) => sum + (r.end - r.start) / 60000, 0);
    result.openMinutes += freeMinutes;
    result.bookedMinutes += (range.end - range.start) / 60000 - freeMinutes;
    for (const id of bookableVisitTypeIds(block, enabledIds)) {
      const duration = visitTypes.find((v) => v.id === id)!.durationMinutes;
      result.openSlotsByVisitType[id] += free.reduce(
        (sum, r) => sum + slotsThatFit((r.end - r.start) / 60000, duration),
        0
      );
    }
  }

  for (const vt of visitTypes) {
    if (vt.maxPerDay === undefined) continue;
    const booked = active.filter((a) => a.visitTypeId === vt.id).length;
    result.openSlotsByVisitType[vt.id] = Math.min(
      result.openSlotsByVisitType[vt.id],
      Math.max(0, vt.maxPerDay - booked)
    );
  }
  return result;
};

export interface TemplateIssue {
  blockIds: string[];
  message: string;
}

/** Problems that should block saving a template. */
export const validateTemplate = (template: ProviderScheduleTemplate): TemplateIssue[] => {
  const issues: TemplateIssue[] = [];
  if (!template.name.trim()) issues.push({ blockIds: [], message: 'Template needs a name.' });
  if (template.effectiveTo && template.effectiveTo < template.effectiveFrom) {
    issues.push({ blockIds: [], message: 'Effective end date is before the start date.' });
  }
  if (!Number.isInteger(template.cycleWeeks) || template.cycleWeeks < 1 || template.cycleWeeks > 4) {
    issues.push({ blockIds: [], message: 'Cycle length must be 1–4 weeks.' });
  }

  for (const block of template.blocks) {
    if (!isValidTimeOfDay(block.startTime) || !isValidTimeOfDay(block.endTime)) {
      issues.push({ blockIds: [block.id], message: `"${block.label}" has an invalid time.` });
    } else if (timeToMinutes(block.endTime) <= timeToMinutes(block.startTime)) {
      issues.push({ blockIds: [block.id], message: `"${block.label}" ends before it starts.` });
    }
    if (block.cycleWeek < 1 || block.cycleWeek > template.cycleWeeks) {
      issues.push({ blockIds: [block.id], message: `"${block.label}" is in a week outside the cycle.` });
    }
  }

  const valid = template.blocks.filter(
    (b) =>
      isValidTimeOfDay(b.startTime) &&
      isValidTimeOfDay(b.endTime) &&
      timeToMinutes(b.endTime) > timeToMinutes(b.startTime)
  );
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i];
      const b = valid[j];
      if (a.weekday !== b.weekday || a.cycleWeek !== b.cycleWeek) continue;
      if (
        timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
        timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
      ) {
        issues.push({ blockIds: [a.id, b.id], message: `"${a.label}" overlaps "${b.label}".` });
      }
    }
  }
  return issues;
};

/**
 * True when an active appointment isn't fully covered by bookable blocks that allow its visit
 * type — typically because the template or an exception changed after it was booked.
 */
export const isAppointmentOutsideSchedule = (
  appointment: ScheduledAppointment,
  blocks: ScheduleBlockInstance[],
  enabledVisitTypeIds: string[]
): boolean => {
  if (appointment.status === 'cancelled' || appointment.status === 'no-show') return false;
  const toMs = (iso: string): number => DateTime.fromISO(iso).toMillis();
  const covering = blocks
    .filter((b) => bookableVisitTypeIds(b, enabledVisitTypeIds).includes(appointment.visitTypeId))
    .map((b) => ({ start: toMs(b.start), end: toMs(b.end) }));
  return subtractRanges({ start: toMs(appointment.start), end: toMs(appointment.end) }, covering).length > 0;
};
