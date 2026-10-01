/**
 * The 12-lead EKG interpretation: the choice lists behind the ekg family's interpretation fields and the
 * QTc arithmetic. Wording follows the conventional machine-read statement set; lists are most-common-first.
 */
import { readNumber, StructuredFacts } from '../structured-fields';

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
