/**
 * Pure geometry and text for the Flowsheets › Immunizations age timeline (decision #9, mockup concept 4): lane
 * positions on a log age axis, the next-dose bar, the window a given dose was due in, and the detail texts.
 */
import { DateTime } from 'luxon';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import {
  DoseWindow,
  EvaluatedDose,
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
  ImmunizationGroupStatus,
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

/** The smallest range that still shows the patient's age (the last one when none does). */
export const defaultRange = (ageMonths: number, ranges: TimelineRange[]): TimelineRange =>
  ranges.find((range) => ageMonths <= range.maxMonths) ?? ranges[ranges.length - 1];

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

export type TimelineSegmentKind = 'earliest' | 'recommended' | 'pastdue' | 'window-earliest' | 'window-recommended';

export interface TimelineSegment {
  kind: TimelineSegmentKind;
  /** Months of age. */
  from: number;
  to: number;
  late?: boolean;
  title: string;
}

const segment = (
  kind: TimelineSegmentKind,
  from: number,
  to: number,
  maxMonths: number,
  title: string,
  late?: boolean
): TimelineSegment | undefined => {
  const clippedTo = Math.min(to, maxMonths);
  if (from >= maxMonths || clippedTo <= 0 || clippedTo <= from) return undefined;
  return { kind, from: Math.max(0, from), to: clippedTo, title, ...(late && { late }) };
};

export const formatDate = (iso: string): string => DateTime.fromISO(iso).toFormat(DATE_FORMAT);

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
  const today = ageInMonths(dob, asOf);
  const segments = [
    segment('earliest', earliest, recommended, maxMonths, `Dose ${next.n}: earliest ${formatDate(next.earliest)}`),
    segment(
      'recommended',
      Math.max(earliest, recommended),
      pastDue ?? maxMonths,
      maxMonths,
      `Dose ${next.n}: recommended ${formatDate(next.recommended)}${
        next.pastDue ? `, past due ${formatDate(next.pastDue)}` : ''
      }`
    ),
    pastDue !== null && today > pastDue
      ? segment('pastdue', pastDue, today, maxMonths, `Dose ${next.n}: past due since ${formatDate(next.pastDue!)}`)
      : undefined,
  ];
  return segments.filter((candidate): candidate is TimelineSegment => candidate !== undefined);
}

export const windowText = (window: DoseWindow): string =>
  [
    window.earliest && window.earliest !== window.recommended ? `earliest ${formatDate(window.earliest)}` : '',
    window.recommended ? `recommended ${formatDate(window.recommended)}` : '',
    window.pastDue ? `past due after ${formatDate(window.pastDue)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

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
  return [
    earliest !== null ? segment('window-earliest', earliest, recommended, maxMonths, title) : undefined,
    pastDue !== null ? segment('window-recommended', recommended, pastDue, maxMonths, title, late) : undefined,
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

/** "Declined 11/10/2026 by J. Nurse", plus ", cleared 12/08/2026 by Dr. Patel" once cleared. */
export const markText = (mark: ImmunizationMark): string =>
  `${MARK_LABELS[mark.mark]} ${formatDate(mark.markedAt)} by ${mark.markedBy.name}` +
  (mark.cleared ? `, cleared ${formatDate(mark.cleared.at)} by ${mark.cleared.by.name}` : '');

/** Every mark ever made on the group, newest first, as the history line of the details box. */
export const markHistoryText = (marks: ImmunizationMark[], group: ImmunizationGroupId): string =>
  marks
    .filter((mark) => mark.vaccineGroup.code === group)
    .map(markText)
    .join('; ');

export const activeMark = (marks: ImmunizationMark[], group: ImmunizationGroupId): ImmunizationMark | undefined =>
  marks.find((mark) => mark.vaccineGroup.code === group && !mark.cleared);

/** The other lanes the same shot counted in, e.g. "Polio 1, Hib 1" for a Pentacel dose on the DTaP lane. */
export const sameShotText = (forecast: ImmunizationForecast, doseId: string, group: ImmunizationGroupId): string =>
  forecast.groups
    .filter((candidate) => candidate.group !== group)
    .flatMap((candidate) =>
      candidate.doses
        .filter((dose) => dose.id === doseId && dose.counted)
        .map((dose) => `${candidate.label} ${dose.doseNumber}`)
    )
    .join(', ');
