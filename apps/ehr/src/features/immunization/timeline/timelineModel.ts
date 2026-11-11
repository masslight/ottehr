/**
 * Pure geometry and text for the Flowsheets › Immunizations age timeline (decision #9, mockup concept 4): lane
 * positions on a log age axis, the next-dose bar, the window a given dose was due in, and the detail texts.
 */
import { DateTime } from 'luxon';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { FORECAST_GROUPS } from 'utils/lib/immunization-forecast/groups';
import {
  DoseWindow,
  EvaluatedDose,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
  ImmunizationGroupStatus,
  NextDose,
  ProjectedDose,
  ProjectedDoses,
} from 'utils/lib/immunization-forecast/types';
import { ImmunizationMark } from 'utils/lib/types/data/immunization/types';

export interface TimelineRange {
  label: string;
  maxMonths: number;
}

const CHILD_RANGES: TimelineRange[] = [
  { label: '0–2 y', maxMonths: 24 },
  { label: '0–7 y', maxMonths: 84 },
  { label: '0–18 y', maxMonths: 216 },
];
const ADULT_AGE_MONTHS = 19 * 12;

/** The childhood ranges, plus one reaching past the patient's age (rounded up to ten years) for an adult. */
export function timelineRanges(ageMonths: number): TimelineRange[] {
  if (ageMonths < ADULT_AGE_MONTHS) return CHILD_RANGES;
  const maxMonths = Math.ceil((ageMonths + 12) / 120) * 120;
  return [...CHILD_RANGES, { label: `0–${maxMonths / 12} y`, maxMonths }];
}

/** How far past today the default range stretches to show projected later doses. */
const PROJECTION_REACH_MONTHS = 60;

/**
 * The smallest range that still shows the patient's age (the last one when none does) and the last projected later
 * dose's recommended date, as far as five years past today.
 */
export const defaultRange = (ageMonths: number, ranges: TimelineRange[], projectedMonths = 0): TimelineRange => {
  const shown = Math.max(ageMonths, Math.min(projectedMonths, ageMonths + PROJECTION_REACH_MONTHS));
  return ranges.find((range) => shown <= range.maxMonths) ?? ranges[ranges.length - 1];
};

/** Age at the latest recommended date among the projected later doses; 0 when there are none. */
export const lastProjectedMonths = (projections: ProjectedDoses | undefined, dob: string): number =>
  Math.max(
    0,
    ...Object.values(projections ?? {})
      .flatMap((doses) => doses ?? [])
      .map((dose) => ageInMonths(dob, dose.recommended))
  );

/** Age in (fractional) months on `date`; both ISO dates or date-times, read in the browser's zone. */
export const ageInMonths = (dob: string, date: string): number =>
  DateTime.fromISO(date).startOf('day').diff(DateTime.fromISO(dob).startOf('day'), 'months').months;

/** Position on the axis, 0–100 %. Logarithmic so infancy, where most doses are, gets most of the width. */
export const xPercent = (months: number, maxMonths: number): number =>
  Math.max(0, Math.min(100, (Math.log1p(Math.max(0, months) / 1.5) / Math.log1p(maxMonths / 1.5)) * 100));

export const formatAge = (months: number): string =>
  months < 0.5 ? 'birth' : months < 24 ? `${+months.toFixed(1)} mo` : `${Math.round(months / 12)} y`;

export interface TimelineTick {
  months: number;
  label: string;
}

const TICKS: TimelineTick[] = [
  { months: 0, label: 'Birth' },
  { months: 2, label: '2m' },
  { months: 4, label: '4m' },
  { months: 6, label: '6m' },
  { months: 9, label: '9m' },
  { months: 12, label: '12m' },
  { months: 15, label: '15m' },
  { months: 18, label: '18m' },
  { months: 24, label: '2y' },
  { months: 36, label: '3y' },
  { months: 48, label: '4y' },
  { months: 60, label: '5y' },
  { months: 72, label: '6y' },
  { months: 84, label: '7y' },
  { months: 132, label: '11y' },
  { months: 156, label: '13y' },
  { months: 192, label: '16y' },
  { months: 216, label: '18y' },
];
const SPARSE_AT_WIDE_RANGE = [9, 15, 36, 60, 72];

export function timelineTicks(maxMonths: number): TimelineTick[] {
  const ticks = TICKS.filter(
    (tick) => tick.months <= maxMonths && !(maxMonths > 84 && SPARSE_AT_WIDE_RANGE.includes(tick.months))
  );
  // Adult ranges: a tick every ten years past 18.
  for (let years = 20; years * 12 <= maxMonths; years += 10) ticks.push({ months: years * 12, label: `${years}y` });
  return ticks;
}

export type TimelineSegmentKind =
  | 'earliest'
  | 'recommended'
  | 'pastdue'
  | 'window-earliest'
  | 'window-recommended'
  | 'projected-earliest'
  | 'projected-recommended';

export interface TimelineSegment {
  kind: TimelineSegmentKind;
  /** Months of age. */
  from: number;
  to: number;
  late?: boolean;
  title: string;
  /** The hover text, one short line: what this part of the bar means for the dose. */
  tip: string;
}

const segment = (
  kind: TimelineSegmentKind,
  from: number,
  to: number,
  maxMonths: number,
  title: string,
  tip: string,
  late?: boolean
): TimelineSegment | undefined => {
  const clippedTo = Math.min(to, maxMonths);
  if (from >= maxMonths || clippedTo <= 0 || clippedTo <= from) return undefined;
  return { kind, from: Math.max(0, from), to: clippedTo, title, tip, ...(late && { late }) };
};

export const formatDate = (iso: string): string => DateTime.fromISO(iso).toFormat(DATE_FORMAT);

const dayBefore = (iso: string): string => DateTime.fromISO(iso).minus({ days: 1 }).toISODate()!;

/** "Hib dose 2 early window: 01/06/2026 – 01/19/2026": from `from` to the day before `until`. */
const windowTip = (name: string, which: 'early window' | 'window', from: string, until: string | null): string =>
  until
    ? `${name} ${which}: ${formatDate(from)} – ${formatDate(dayBefore(until))}`
    : `${name} ${which}: from ${formatDate(from)}`;

const SEASONAL_GROUPS = new Set(FORECAST_GROUPS.filter((group) => group.seasonal).map((group) => group.id));

/** The next dose's window: up to the day before past due, else through the season's last day, else open-ended. */
const nextWindowTip = (name: string, group: ImmunizationGroupForecast['group'], next: NextDose): string => {
  if (next.pastDue || !next.seasonEnd) {
    const tip = windowTip(name, 'window', next.recommended, next.pastDue);
    return !next.pastDue && SEASONAL_GROUPS.has(group) ? `${tip} (no season end date published)` : tip;
  }
  return `${name} window: ${formatDate(next.recommended)} – ${formatDate(next.seasonEnd)}`;
};

const NO_NEXT_BAR: ImmunizationGroupStatus[] = ['complete', 'notroutine', 'contraindicated', 'immune'];

/** The next dose as a bar: earliest → recommended → past due, plus a past-due segment up to today. */
export function nextDoseSegments(
  group: ImmunizationGroupForecast,
  dob: string,
  asOf: string,
  maxMonths: number
): TimelineSegment[] {
  const next = group.next;
  if (!next || NO_NEXT_BAR.includes(group.status)) return [];
  const earliest = ageInMonths(dob, next.earliest);
  const recommended = ageInMonths(dob, next.recommended);
  const pastDue = next.pastDue ? ageInMonths(dob, next.pastDue) : null;
  const seasonEnd = next.seasonEnd ? ageInMonths(dob, next.seasonEnd) : null;
  const today = ageInMonths(dob, asOf);
  const name = `${group.label} dose ${next.n}`;
  const segments = [
    segment(
      'earliest',
      earliest,
      recommended,
      maxMonths,
      `Dose ${next.n}: earliest ${formatDate(next.earliest)}`,
      windowTip(name, 'early window', next.earliest, next.recommended)
    ),
    segment(
      'recommended',
      Math.max(earliest, recommended),
      pastDue ?? seasonEnd ?? maxMonths,
      maxMonths,
      `Dose ${next.n}: recommended ${formatDate(next.recommended)}${
        next.pastDue ? `, past due ${formatDate(next.pastDue)}` : ''
      }`,
      nextWindowTip(name, group.group, next)
    ),
    pastDue !== null && today > pastDue
      ? segment(
          'pastdue',
          pastDue,
          today,
          maxMonths,
          `Dose ${next.n}: past due since ${formatDate(next.pastDue!)}`,
          `${name} past due since ${formatDate(next.pastDue!)}`
        )
      : undefined,
  ];
  return segments.filter((candidate): candidate is TimelineSegment => candidate !== undefined);
}

/** "Polio dose 3 (projected): recommended 01/08/2027, past due after 03/06/2028, if dose 2 is given on time." */
export const projectedDoseText = (laneLabel: string, dose: ProjectedDose): string =>
  `${laneLabel} dose ${dose.n} (projected): recommended ${formatDate(dose.recommended)}${
    dose.pastDue ? `, past due after ${formatDate(dose.pastDue)}` : ''
  }, if dose ${dose.n - 1} is given on time.`;

/**
 * A later dose, if each dose before it is given on time, drawn in outline: allowed but early, then its window up to
 * the past-due date.
 */
export function projectedDoseSegments(
  dose: ProjectedDose,
  laneLabel: string,
  dob: string,
  maxMonths: number
): TimelineSegment[] {
  const earliest = ageInMonths(dob, dose.earliest);
  const recommended = ageInMonths(dob, dose.recommended);
  const pastDue = dose.pastDue ? ageInMonths(dob, dose.pastDue) : null;
  const title = projectedDoseText(laneLabel, dose);
  const name = `${laneLabel} dose ${dose.n}`;
  const dependsOn = `(depends on dose ${dose.n - 1})`;
  return [
    segment(
      'projected-earliest',
      earliest,
      recommended,
      maxMonths,
      title,
      `${windowTip(name, 'early window', dose.earliest, dose.recommended)} ${dependsOn}`
    ),
    segment(
      'projected-recommended',
      Math.max(earliest, recommended),
      pastDue ?? maxMonths,
      maxMonths,
      title,
      `${windowTip(name, 'window', dose.recommended, dose.pastDue)} ${dependsOn}`
    ),
  ].filter((candidate): candidate is TimelineSegment => candidate !== undefined);
}

/** Where a dose still to come shows its number: the start of its bar's recommended part (null when off the range). */
export const doseLabelMonths = (segments: TimelineSegment[]): number | null =>
  segments.find((candidate) => candidate.kind === 'recommended' || candidate.kind === 'projected-recommended')?.from ??
  null;

export const windowText = (window: DoseWindow): string =>
  [
    window.earliest && window.earliest !== window.recommended ? `earliest ${formatDate(window.earliest)}` : '',
    window.recommended ? `recommended ${formatDate(window.recommended)}` : '',
    window.pastDue ? `past due after ${formatDate(window.pastDue)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

const GIVEN_TIMING = { early: 'early', 'on-time': 'on time', late: 'late' } as const;
const TIMING_TEXT = { early: 'Given early', 'on-time': 'Given on time', late: 'Given late' } as const;

export const timingText = (dose: EvaluatedDose): string | undefined =>
  dose.timing ? TIMING_TEXT[dose.timing] : undefined;

/** The window a counted dose was due in, as a thin band behind its circle; red when the dose was late. */
export function givenDoseWindowSegments(
  dose: EvaluatedDose,
  dob: string,
  maxMonths: number,
  laneLabel: string
): TimelineSegment[] {
  const window = dose.window;
  if (!window || !dose.date || !window.recommended) return [];
  const late = dose.timing === 'late';
  const earliest = window.earliest ? ageInMonths(dob, window.earliest) : null;
  const recommended = ageInMonths(dob, window.recommended);
  const pastDue = window.pastDue ? ageInMonths(dob, window.pastDue) : null;
  const title = `${laneLabel} dose ${dose.doseNumber} window: ${windowText(window)}. ${
    timingText(dose) ?? 'Given'
  } at ${formatAge(ageInMonths(dob, dose.date))}.`;
  const tip = `${laneLabel} dose ${dose.doseNumber} given ${formatDate(dose.date)}${
    dose.timing ? ` (${GIVEN_TIMING[dose.timing]})` : ''
  }`;
  return [
    earliest !== null ? segment('window-earliest', earliest, recommended, maxMonths, title, tip) : undefined,
    pastDue !== null ? segment('window-recommended', recommended, pastDue, maxMonths, title, tip, late) : undefined,
  ].filter((candidate): candidate is TimelineSegment => candidate !== undefined);
}

export const STATUS_LABELS: Record<ImmunizationGroupStatus, string> = {
  notyet: 'Not yet due',
  uptodate: 'Up to date',
  due: 'Due today',
  pastdue: 'Past due',
  complete: 'Complete',
  notroutine: 'Not routine',
  immune: 'Immune',
  contraindicated: 'Contraindicated',
  declined: 'Declined',
};

const MARK_LABELS = { immune: 'Immune', contraindicated: 'Contraindicated', declined: 'Declined' } as const;

/** "11/10/2026 · recorded by J. Nurse": who recorded the mark, not who declined; a blank name drops that part. */
export const markRecordedText = (mark: ImmunizationMark): string =>
  `${formatDate(mark.markedAt)}${mark.markedBy.name.trim() ? ` · recorded by ${mark.markedBy.name}` : ''}`;

/** "Declined 11/10/2026 · recorded by J. Nurse", plus ", cleared 12/08/2026 by Dr. Patel" once cleared. */
export const markText = (mark: ImmunizationMark): string =>
  `${MARK_LABELS[mark.mark]} ${markRecordedText(mark)}` +
  (mark.cleared
    ? `, cleared ${formatDate(mark.cleared.at)}${mark.cleared.by.name.trim() ? ` by ${mark.cleared.by.name}` : ''}`
    : '');

/** Every mark ever made on the group, newest first, as the history line of the details box. */
export const markHistoryText = (marks: ImmunizationMark[], group: ImmunizationGroupId): string =>
  marks
    .filter((mark) => mark.vaccineGroup.code === group)
    .map(markText)
    .join('; ');

export const activeMark = (marks: ImmunizationMark[], group: ImmunizationGroupId): ImmunizationMark | undefined =>
  marks.find((mark) => mark.vaccineGroup.code === group && !mark.cleared);
