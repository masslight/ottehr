/**
 * The 12-lead EKG interpretation: the choice lists behind the ekg family's interpretation fields, the QTc
 * arithmetic, the suggested interpretations ranked for the entered numbers and the reminders where a chosen
 * read contradicts them. Wording follows the conventional machine-read statement set; lists are
 * most-common-first. Plain rules on the typed numbers: nothing reads the tracing.
 */
import { isSentenceBlank, SentenceBlank, SentenceSegment } from '../../helpers/suggested-sentences';
import { readNumber, readStrings, StructuredFacts } from '../structured-fields';

export const EKG_RHYTHMS = [
  'sinus rhythm',
  'sinus bradycardia',
  'sinus tachycardia',
  'sinus arrhythmia',
  'atrial fibrillation',
  'atrial flutter',
  'junctional rhythm',
  'supraventricular tachycardia',
  'paced rhythm',
];

export const EKG_AXES = ['normal', 'left axis deviation', 'right axis deviation', 'indeterminate'];

export const EKG_CONDUCTION = [
  'normal',
  'first-degree AV block',
  'right bundle branch block',
  'left bundle branch block',
  'incomplete RBBB',
  'left anterior fascicular block',
  'prolonged QTc',
  'second-degree AV block, Mobitz I',
  'second-degree AV block, Mobitz II',
  'complete heart block',
  'nonspecific conduction delay',
];

export const EKG_ST_T = [
  'no acute ST-T wave changes',
  'nonspecific ST-T wave changes',
  'ST elevation, inferior leads',
  'ST elevation, anterior leads',
  'ST elevation, lateral leads',
  'ST depression, lateral leads',
  'T-wave inversion, inferior leads',
  'peaked T waves',
  'early repolarization',
];

export const EKG_OTHER_FINDINGS = [
  'none',
  'left ventricular hypertrophy',
  'right ventricular hypertrophy',
  'Q waves, inferior (old infarct)',
  'poor R-wave progression',
  'low voltage',
  'premature ventricular complexes',
];

export const EKG_COMPARISONS = ['no significant change', 'changed (describe)', 'no prior EKG available'];

export const EKG_IMPRESSIONS = ['normal ECG', 'otherwise normal ECG', 'borderline ECG', 'abnormal ECG'];

/** How the saved QTc was arrived at; the letters on the page's B / F / M toggle. */
export const QTC_METHODS = ['Bazett', 'Fridericia', 'manual'] as const;
export type QtcMethod = (typeof QTC_METHODS)[number];
const DEFAULT_QTC_METHOD: QtcMethod = 'Bazett';

export const calculateQtc = (qt: number, rate: number, method: Exclude<QtcMethod, 'manual'>): number => {
  const rr = 60 / rate;
  return Math.round(qt / (method === 'Fridericia' ? Math.cbrt(rr) : Math.sqrt(rr)));
};

export const ekgQtcMethod = (facts: StructuredFacts): QtcMethod =>
  QTC_METHODS.find((method) => method === facts.qtcMethod) ?? DEFAULT_QTC_METHOD;

/** The QTc the page shows: the typed value under manual entry, otherwise calculated from QT and rate. */
export function ekgQtc(facts: StructuredFacts): number | undefined {
  const method = ekgQtcMethod(facts);
  if (method === 'manual') return readNumber(facts, 'qtc');
  const qt = readNumber(facts, 'qt');
  const rate = readNumber(facts, 'rate');
  return qt && rate ? calculateQtc(qt, rate, method) : undefined;
}

/** The facts with the stored QTc and method kept in step with QT and rate, so the saved note needs no arithmetic. */
export function withEkgQtc(facts: StructuredFacts): StructuredFacts {
  const method = ekgQtcMethod(facts);
  if (method === 'manual') return facts;
  const qtc = ekgQtc(facts);
  return qtc === undefined ? { ...facts, qtc: undefined } : { ...facts, qtc, qtcMethod: method };
}

export interface EkgMeasurements {
  rate?: number;
  pr?: number;
  qrs?: number;
  qt?: number;
  qtc?: number;
}

export const ekgMeasurements = (facts: StructuredFacts): EkgMeasurements => ({
  rate: readNumber(facts, 'rate'),
  pr: readNumber(facts, 'pr'),
  qrs: readNumber(facts, 'qrs'),
  qt: readNumber(facts, 'qt'),
  qtc: ekgQtc(facts),
});

/** The interpretation fields a suggestion, quick pick or reminder fills; keys are the ekg family's. */
export interface EkgInterpretation {
  rhythm?: string;
  axis?: string;
  conduction?: string[];
  stt?: string[];
  otherFindings?: string[];
  comparison?: string;
  impression?: string;
}

const NORMAL_READ: EkgInterpretation = {
  rhythm: 'sinus rhythm',
  axis: 'normal',
  conduction: ['normal'],
  stt: ['no acute ST-T wave changes'],
  otherFindings: ['none'],
  impression: 'normal ECG',
};

/** Adult cut-offs behind the suggestions and reminders; limits for children differ and are not applied. */
const BRADYCARDIA_BELOW = 60;
const TACHYCARDIA_ABOVE = 100;
const FIRST_DEGREE_BLOCK_PR_OVER = 200;
const WIDE_QRS_FROM = 120;
const PROLONGED_QTC_OVER = 450;

/** A blank in a suggested interpretation names the field choice it stands for. */
export interface EkgSuggestionBlank extends SentenceBlank {
  key: string;
}

export interface EkgSuggestion {
  id: string;
  segments: SentenceSegment[];
  /** Why the numbers rank it; empty for the standing offers. */
  reason?: string;
  /** The interpretation the row fills, given each blank's value by key. */
  picks: (choice: Record<string, string>) => EkgInterpretation;
}

const blank = (key: string, title: string, options: string[], initial = options[0]): EkgSuggestionBlank => ({
  key,
  title,
  options,
  initial,
});

/**
 * Up to three complete interpretations ranked for the entered numbers, each with the reason it is offered.
 * Nothing until rate and QT are in; under 18 only the normal read, since the cut-offs are adult ones.
 */
export function suggestEkgInterpretations(numbers: EkgMeasurements, isChild: boolean): EkgSuggestion[] {
  const { rate, pr, qrs, qt, qtc } = numbers;
  if (rate === undefined || qt === undefined) return [];
  const slow = rate < BRADYCARDIA_BELOW;
  const fast = rate > TACHYCARDIA_ABOVE;
  const longPr = pr !== undefined && pr > FIRST_DEGREE_BLOCK_PR_OVER;
  const wideQrs = qrs !== undefined && qrs >= WIDE_QRS_FROM;
  const longQtc = qtc !== undefined && qtc > PROLONGED_QTC_OVER;
  const allNormal = !slow && !fast && !longPr && !wideQrs && !longQtc;

  const normal: EkgSuggestion = {
    id: 'normal',
    segments: [
      'Sinus rhythm. Normal axis. Normal intervals. No acute ST-T wave changes. Impression: ',
      blank('impression', 'Impression', ['normal ECG', 'otherwise normal ECG']),
      '.',
    ],
    picks: (choice) => ({ ...NORMAL_READ, impression: choice.impression }),
  };
  if (isChild) return [normal];

  const ranked: { score: number; suggestion: EkgSuggestion }[] = [
    { score: allNormal ? 10 : 2, suggestion: normal },
    {
      score: slow || fast ? 9 : 0,
      suggestion: {
        id: 'rate',
        segments: [
          blank(
            'rhythm',
            'Rhythm',
            ['Sinus bradycardia', 'Sinus tachycardia', 'Sinus arrhythmia'],
            fast ? 'Sinus tachycardia' : 'Sinus bradycardia'
          ),
          ', rate ',
          { number: String(rate) },
          '. Normal axis. Normal intervals. No acute ST-T wave changes. Impression: ',
          blank('impression', 'Impression', ['otherwise normal ECG', 'borderline ECG', 'abnormal ECG']),
          '.',
        ],
        reason: `rate ${rate} is ${fast ? `above ${TACHYCARDIA_ABOVE}` : `below ${BRADYCARDIA_BELOW}`}`,
        picks: (choice) => ({ ...NORMAL_READ, rhythm: choice.rhythm.toLowerCase(), impression: choice.impression }),
      },
    },
    {
      score: longPr ? 9 : 0,
      suggestion: {
        id: 'first-degree-block',
        segments: [
          'Sinus rhythm with first-degree AV block, PR ',
          { number: String(pr) },
          ' ms. Normal axis. No acute ST-T wave changes. Impression: ',
          blank('impression', 'Impression', ['borderline ECG', 'abnormal ECG', 'otherwise normal ECG']),
          '.',
        ],
        reason: `PR ${pr} ms is over ${FIRST_DEGREE_BLOCK_PR_OVER}`,
        picks: (choice) => ({ ...NORMAL_READ, conduction: ['first-degree AV block'], impression: choice.impression }),
      },
    },
    {
      score: wideQrs ? 9 : 0,
      suggestion: {
        id: 'wide-qrs',
        segments: [
          'Sinus rhythm with ',
          blank('conduction', 'Conduction', [
            'right bundle branch block',
            'left bundle branch block',
            'nonspecific conduction delay',
          ]),
          ', QRS ',
          { number: String(qrs) },
          ' ms. ',
          blank('axis', 'Axis', ['Normal axis', 'Left axis deviation', 'Right axis deviation']),
          '. ',
          blank('stt', 'ST / T', ['No acute ST-T wave changes', 'Secondary ST-T wave changes']),
          '. Impression: abnormal ECG.',
        ],
        reason: `QRS ${qrs} ms is ${WIDE_QRS_FROM} or more`,
        picks: (choice) => ({
          ...NORMAL_READ,
          conduction: [choice.conduction],
          axis: choice.axis === 'Normal axis' ? 'normal' : choice.axis.toLowerCase(),
          stt: [
            choice.stt === 'No acute ST-T wave changes'
              ? 'no acute ST-T wave changes'
              : 'nonspecific ST-T wave changes',
          ],
          impression: 'abnormal ECG',
        }),
      },
    },
    {
      score: longQtc ? 8 : 0,
      suggestion: {
        id: 'prolonged-qtc',
        segments: [
          'Sinus rhythm. Prolonged QTc, ',
          { number: String(qtc) },
          ' ms. Normal axis. No acute ST-T wave changes. Impression: ',
          blank('impression', 'Impression', ['abnormal ECG', 'borderline ECG']),
          '.',
        ],
        reason: `QTc ${qtc} ms is above ${PROLONGED_QTC_OVER}`,
        picks: (choice) => ({ ...NORMAL_READ, conduction: ['prolonged QTc'], impression: choice.impression }),
      },
    },
    {
      score: 1,
      suggestion: {
        id: 'nonspecific-st-t',
        segments: [
          'Sinus rhythm. Nonspecific ST-T wave changes. Normal axis. Normal intervals. Impression: ',
          blank('impression', 'Impression', ['borderline ECG', 'abnormal ECG']),
          '.',
        ],
        picks: (choice) => ({ ...NORMAL_READ, stt: ['nonspecific ST-T wave changes'], impression: choice.impression }),
      },
    },
  ];
  return ranked
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.suggestion);
}

/** The interpretation a row fills, with `picks[i]` (by segment, as the page keeps them) over each blank's default. */
export function ekgSuggestionPicks(suggestion: EkgSuggestion, picks: (string | undefined)[]): EkgInterpretation {
  const choice: Record<string, string> = {};
  suggestion.segments.forEach((segment, i) => {
    if (isSentenceBlank(segment)) choice[(segment as EkgSuggestionBlank).key] = picks[i] ?? segment.initial ?? '';
  });
  return suggestion.picks(choice);
}

const sameChoice = (a: StructuredFacts[string], b: string | string[] | undefined): boolean =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((item, i) => item === b[i]) : a === b;

/** Whether the interpretation fields already hold exactly what the row would fill in. */
export const isEkgInterpretationApplied = (facts: StructuredFacts, read: EkgInterpretation): boolean =>
  Object.entries(read).every(([key, value]) => sameChoice(facts[key], value));

export interface EkgReminderFix {
  label: string;
  apply: EkgInterpretation;
}

export interface EkgReminder {
  message: string;
  fixes: EkgReminderFix[];
}

/**
 * Where the chosen interpretation contradicts the numbers, by the adult cut-offs: the caller leaves these
 * out for a child. Each comes with the one-click change that resolves it; none blocks saving.
 */
export function ekgReminders(facts: StructuredFacts): EkgReminder[] {
  const { pr, qrs, qtc } = ekgMeasurements(facts);
  const conduction = readStrings(facts, 'conduction');
  const saysNormal = conduction.includes('normal');
  const withFinding = (finding: string): EkgInterpretation => ({
    conduction: [...conduction.filter((item) => item !== 'normal'), finding],
  });
  const findings: string[] = [];
  const reminders: EkgReminder[] = [];
  if (pr !== undefined && pr > FIRST_DEGREE_BLOCK_PR_OVER) {
    findings.push('first-degree AV block');
    if (saysNormal)
      reminders.push({
        message: `A PR of ${pr} ms meets the definition of first-degree AV block; Intervals says "normal".`,
        fixes: [{ label: 'Add first-degree AV block', apply: withFinding('first-degree AV block') }],
      });
  }
  if (qrs !== undefined && qrs >= WIDE_QRS_FROM) {
    findings.push('wide QRS');
    if (saysNormal)
      reminders.push({
        message: `A QRS of ${qrs} ms is wide, consistent with a bundle branch block or conduction delay; Intervals says "normal".`,
        fixes: ['right bundle branch block', 'left bundle branch block', 'nonspecific conduction delay'].map(
          (finding) => ({ label: `Add ${finding}`, apply: withFinding(finding) })
        ),
      });
  }
  if (qtc !== undefined && qtc > PROLONGED_QTC_OVER) {
    findings.push('prolonged QTc');
    if (saysNormal)
      reminders.push({
        message: `A QTc of ${qtc} ms is prolonged; Intervals says "normal".`,
        fixes: [{ label: 'Add prolonged QTc', apply: withFinding('prolonged QTc') }],
      });
  }
  if (findings.length && facts.impression === 'normal ECG')
    reminders.push({
      message: `Impression is "normal ECG", but the findings above (${findings.join(
        ', '
      )}) make it borderline or abnormal.`,
      fixes: [
        { label: 'Change impression', apply: { impression: findings.length > 1 ? 'abnormal ECG' : 'borderline ECG' } },
      ],
    });
  return reminders;
}
