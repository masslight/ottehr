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

export const EKG_COMPARISONS = ['no prior EKG available', 'no significant change', 'changed (describe)'];

export const EKG_IMPRESSIONS = ['normal EKG', 'otherwise normal EKG', 'borderline EKG', 'abnormal EKG'];

export interface EkgInterpretation {
  rhythm?: string;
  axis?: string;
  conduction?: string[];
  stt?: string[];
  otherFindings?: string[];
  comparison?: string;
  impression?: string;
}

export const EKG_NORMAL_READ: EkgInterpretation = {
  rhythm: 'sinus rhythm',
  axis: 'normal',
  conduction: ['normal'],
  stt: ['no acute ST-T wave changes'],
  otherFindings: ['none'],
  impression: 'normal EKG',
};

export type EkgFinding = 'slow' | 'fast' | 'longPr' | 'wideQrs' | 'longQtc';

export const EKG_FINDINGS: Record<EkgFinding, { limit: number; reason: string }> = {
  slow: { limit: 60, reason: 'rate {rate} is below {limit}' },
  fast: { limit: 100, reason: 'rate {rate} is above {limit}' },
  longPr: { limit: 200, reason: 'PR {pr} ms is over {limit}' },
  wideQrs: { limit: 120, reason: 'QRS {qrs} ms is {limit} or more' },
  longQtc: { limit: 450, reason: 'QTc {qtc} ms is above {limit}' },
};

export interface EkgTemplateBlank {
  title: string;
  options: string[];
  initial?: Partial<Record<EkgFinding, string>>;
  fieldValue?: Record<string, string>;
}

export interface EkgTemplate {
  id: string;
  name: string;
  text: string;
  blanks?: Record<string, EkgTemplateBlank>;
  findings?: EkgFinding[];
  rank: number;
  rankWhenNormal?: number;
  forChildren?: boolean;
  fills: EkgInterpretation;
}

const IMPRESSION = 'Impression';

export const EKG_TEMPLATES: EkgTemplate[] = [
  {
    id: 'normal',
    name: 'Normal',
    text: 'Sinus rhythm. Normal axis. Normal intervals. No acute ST-T wave changes. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['normal EKG', 'otherwise normal EKG'] } },
    rank: 2,
    rankWhenNormal: 10,
    forChildren: true,
    fills: { impression: '{impression}' },
  },
  {
    id: 'rate',
    name: 'Sinus bradycardia or tachycardia',
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
    name: 'First-degree AV block',
    text: 'Sinus rhythm with first-degree AV block, PR {pr} ms. Normal axis. No acute ST-T wave changes. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['borderline EKG', 'abnormal EKG', 'otherwise normal EKG'] } },
    findings: ['longPr'],
    rank: 9,
    fills: { conduction: ['first-degree AV block'], impression: '{impression}' },
  },
  {
    id: 'wide-qrs',
    name: 'Bundle branch block or conduction delay',
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
    name: 'Prolonged QTc',
    text: 'Sinus rhythm. Prolonged QTc, {qtc} ms. Normal axis. No acute ST-T wave changes. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['abnormal EKG', 'borderline EKG'] } },
    findings: ['longQtc'],
    rank: 8,
    fills: { conduction: ['prolonged QTc'], impression: '{impression}' },
  },
  {
    id: 'nonspecific-st-t',
    name: 'Nonspecific ST-T changes',
    text: 'Sinus rhythm. Nonspecific ST-T wave changes. Normal axis. Normal intervals. Impression: {impression}.',
    blanks: { impression: { title: IMPRESSION, options: ['borderline EKG', 'abnormal EKG'] } },
    rank: 1,
    fills: { stt: ['nonspecific ST-T wave changes'], impression: '{impression}' },
  },
];
