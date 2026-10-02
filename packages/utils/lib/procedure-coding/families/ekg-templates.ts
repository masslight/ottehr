/**
 * Data behind the 12-lead EKG interpretation: the choice lists of the ekg family's interpretation fields,
 * the adult cut-offs, and the suggested interpretations offered for the typed numbers. Wording follows the
 * conventional machine-read statement set; lists are most-common-first. Edit here; the rules that read this
 * file are in ekg-interpretation.ts.
 */

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

export const EKG_IMPRESSIONS = ['normal EKG', 'otherwise normal EKG', 'borderline EKG', 'abnormal EKG'];

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

/** The read every suggestion starts from; a template changes only the fields it names. */
export const EKG_NORMAL_READ: EkgInterpretation = {
  rhythm: 'sinus rhythm',
  axis: 'normal',
  conduction: ['normal'],
  stt: ['no acute ST-T wave changes'],
  otherFindings: ['none'],
  impression: 'normal EKG',
};

export type EkgFinding = 'slow' | 'fast' | 'longPr' | 'wideQrs' | 'longQtc';

/**
 * Adult cut-offs (limits for children differ and are not applied), each with the reason line shown under a
 * suggestion it ranks: `{rate}` `{pr}` `{qrs}` `{qtc}` are the typed numbers, `{limit}` the cut-off.
 */
export const EKG_FINDINGS: Record<EkgFinding, { limit: number; reason: string }> = {
  slow: { limit: 60, reason: 'rate {rate} is below {limit}' },
  fast: { limit: 100, reason: 'rate {rate} is above {limit}' },
  longPr: { limit: 200, reason: 'PR {pr} ms is over {limit}' },
  wideQrs: { limit: 120, reason: 'QRS {qrs} ms is {limit} or more' },
  longQtc: { limit: 450, reason: 'QTc {qtc} ms is above {limit}' },
};

export interface EkgTemplateBlank {
  title: string;
  /** Sentence words, first one the default */
  options: string[];
  /** A default that depends on which finding the numbers show */
  initial?: Partial<Record<EkgFinding, string>>;
  /** The field option a sentence word stands for, where it is not simply the word in lower case */
  fieldValue?: Record<string, string>;
}

export interface EkgTemplate {
  id: string;
  /** `{rate}` `{pr}` `{qrs}` `{qtc}` print the typed number; any other `{name}` is a blank from `blanks`. */
  text: string;
  blanks?: Record<string, EkgTemplateBlank>;
  /** Offered only when the numbers show one of these (the reason line names it); absent: always offered. */
  findings?: EkgFinding[];
  /** Order among the offered templates, highest first. */
  rank: number;
  /** Rank when the numbers show no finding at all (the normal read then goes first). */
  rankWhenNormal?: number;
  /** The one read offered under 18, where the adult cut-offs do not apply. */
  forChildren?: boolean;
  /** Fields the row fills over EKG_NORMAL_READ; `{name}` takes the blank's choice as a field option. */
  fills: EkgInterpretation;
}

const IMPRESSION = 'Impression';

export const EKG_TEMPLATES: EkgTemplate[] = [
  {
    id: 'normal',
    text: 'Sinus rhythm. Normal axis. Normal intervals. No acute ST-T wave changes. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['normal EKG', 'otherwise normal EKG'] } },
    rank: 2,
    rankWhenNormal: 10,
    forChildren: true,
    fills: { impression: '{impression}' },
  },
  {
    id: 'rate',
    text: '{rhythm}, rate {rate}. Normal axis. Normal intervals. No acute ST-T wave changes. Impression: {impression}.',
    blanks: {
      rhythm: {
        title: 'Rhythm',
        options: ['Sinus bradycardia', 'Sinus tachycardia', 'Sinus arrhythmia'],
        initial: { slow: 'Sinus bradycardia', fast: 'Sinus tachycardia' },
      },
      impression: { title: IMPRESSION, options: ['otherwise normal EKG', 'borderline EKG', 'abnormal EKG'] },
    },
    findings: ['slow', 'fast'],
    rank: 9,
    fills: { rhythm: '{rhythm}', impression: '{impression}' },
  },
  {
    id: 'first-degree-block',
    text: 'Sinus rhythm with first-degree AV block, PR {pr} ms. Normal axis. No acute ST-T wave changes. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['borderline EKG', 'abnormal EKG', 'otherwise normal EKG'] } },
    findings: ['longPr'],
    rank: 9,
    fills: { conduction: ['first-degree AV block'], impression: '{impression}' },
  },
  {
    id: 'wide-qrs',
    text: 'Sinus rhythm with {conduction}, QRS {qrs} ms. {axis}. {stt}. Impression: abnormal EKG.',
    blanks: {
      conduction: {
        title: 'Conduction',
        options: ['right bundle branch block', 'left bundle branch block', 'nonspecific conduction delay'],
      },
      axis: {
        title: 'Axis',
        options: ['Normal axis', 'Left axis deviation', 'Right axis deviation'],
        fieldValue: { 'Normal axis': 'normal' },
      },
      stt: {
        title: 'ST / T',
        options: ['No acute ST-T wave changes', 'Secondary ST-T wave changes'],
        fieldValue: { 'Secondary ST-T wave changes': 'nonspecific ST-T wave changes' },
      },
    },
    findings: ['wideQrs'],
    rank: 9,
    fills: { conduction: ['{conduction}'], axis: '{axis}', stt: ['{stt}'], impression: 'abnormal EKG' },
  },
  {
    id: 'prolonged-qtc',
    text: 'Sinus rhythm. Prolonged QTc, {qtc} ms. Normal axis. No acute ST-T wave changes. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['abnormal EKG', 'borderline EKG'] } },
    findings: ['longQtc'],
    rank: 8,
    fills: { conduction: ['prolonged QTc'], impression: '{impression}' },
  },
  {
    id: 'nonspecific-st-t',
    text: 'Sinus rhythm. Nonspecific ST-T wave changes. Normal axis. Normal intervals. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['borderline EKG', 'abnormal EKG'] } },
    rank: 1,
    fills: { stt: ['nonspecific ST-T wave changes'], impression: '{impression}' },
  },
];
