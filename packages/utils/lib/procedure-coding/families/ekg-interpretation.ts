import { isSentenceBlank, parseTemplate, SentenceBlank, SentenceSegment } from '../../helpers/suggested-sentences';
import { readNumber, readStrings, StructuredFacts } from '../structured-fields';
import {
  EKG_FINDINGS,
  EKG_NORMAL_READ,
  EKG_TEMPLATES,
  EkgFinding,
  EkgInterpretation,
  EkgTemplate,
  EkgTemplateBlank,
} from './ekg-templates';

export const QTC_METHODS = ['Bazett', 'Fridericia', 'manual'] as const;
export type QtcMethod = (typeof QTC_METHODS)[number];
const DEFAULT_QTC_METHOD: QtcMethod = 'Bazett';

export const calculateQtc = (qt: number, rate: number, method: Exclude<QtcMethod, 'manual'>): number => {
  const rr = 60 / rate;
  return Math.round(qt / (method === 'Fridericia' ? Math.cbrt(rr) : Math.sqrt(rr)));
};

export const ekgQtcMethod = (facts: StructuredFacts): QtcMethod =>
  QTC_METHODS.find((method) => method === facts.qtcMethod) ?? DEFAULT_QTC_METHOD;

export function ekgQtc(facts: StructuredFacts): number | undefined {
  const method = ekgQtcMethod(facts);
  if (method === 'manual') return readNumber(facts, 'qtc');
  const qt = readNumber(facts, 'qt');
  const rate = readNumber(facts, 'rate');
  return qt !== undefined && rate !== undefined && qt > 0 && rate > 0 ? calculateQtc(qt, rate, method) : undefined;
}

export function withEkgQtc(facts: StructuredFacts): StructuredFacts {
  const qtc = ekgQtc(facts);
  const picked = QTC_METHODS.find((method) => method === facts.qtcMethod);
  return { ...facts, qtc, qtcMethod: qtc === undefined ? picked : ekgQtcMethod(facts) };
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

export const EKG_MEASUREMENT_KEYS = ['rate', 'pr', 'qrs', 'qt', 'qtc', 'qtcMethod', 'axisDegrees'];

export function ekgMeasurementLine(facts: StructuredFacts): string | undefined {
  const { rate, pr, qrs, qt, qtc } = ekgMeasurements(facts);
  const axis = readNumber(facts, 'axisDegrees');
  const method = qtc === undefined ? '' : ` (${ekgQtcMethod(facts)})`;
  const parts = [
    ...(rate === undefined ? [] : [`Rate ${rate} bpm`]),
    ...(pr === undefined ? [] : [`PR ${pr} ms`]),
    ...(qrs === undefined ? [] : [`QRS ${qrs} ms`]),
    ...(qt !== undefined && qtc !== undefined
      ? [`QT/QTc ${qt}/${qtc} ms${method}`]
      : qt !== undefined
      ? [`QT ${qt} ms`]
      : qtc !== undefined
      ? [`QTc ${qtc} ms${method}`]
      : []),
    ...(axis === undefined ? [] : [`axis ${axis > 0 ? '+' : ''}${axis}°`]),
  ];
  return parts.length ? `${parts.join(', ')}.` : undefined;
}

export function ekgFindings({ rate, pr, qrs, qtc }: EkgMeasurements): EkgFinding[] {
  const found: EkgFinding[] = [];
  if (rate !== undefined && rate < EKG_FINDINGS.slow.limit) found.push('slow');
  if (rate !== undefined && rate > EKG_FINDINGS.fast.limit) found.push('fast');
  if (pr !== undefined && pr > EKG_FINDINGS.longPr.limit) found.push('longPr');
  if (qrs !== undefined && qrs >= EKG_FINDINGS.wideQrs.limit) found.push('wideQrs');
  if (qtc !== undefined && qtc > EKG_FINDINGS.longQtc.limit) found.push('longQtc');
  return found;
}

export interface EkgSuggestionBlank extends SentenceBlank, Pick<EkgTemplateBlank, 'fieldValue'> {
  key: string;
}

export interface EkgSuggestion {
  id: string;
  name: string;
  segments: SentenceSegment[];
  reason?: string;
  fills: EkgInterpretation;
}

const TOKEN = /\{(\w+)\}/g;

const fillTokens = (text: string, values: Record<string, string | number | undefined>): string =>
  text.replace(TOKEN, (token, name) => (values[name] === undefined ? token : String(values[name])));

function templateSegments(template: EkgTemplate, numbers: EkgMeasurements, found: EkgFinding[]): SentenceSegment[] {
  return parseTemplate(template.text, (name) => {
    const blank = template.blanks?.[name];
    if (blank) {
      const byFinding = found.map((finding) => blank.initial?.[finding]).find((initial) => initial !== undefined);
      const segment: EkgSuggestionBlank = {
        key: name,
        title: blank.title,
        options: blank.options,
        initial: byFinding ?? blank.options[0],
        fieldValue: blank.fieldValue,
      };
      return segment;
    }
    const number = numbers[name as keyof EkgMeasurements];
    if (number === undefined) throw new Error(`EKG template "${template.id}" uses an unknown token {${name}}`);
    return { number: String(number) };
  });
}

export function suggestEkgInterpretations(numbers: EkgMeasurements, isChild: boolean): EkgSuggestion[] {
  if (numbers.rate === undefined || numbers.qt === undefined) return [];
  const found = ekgFindings(numbers);
  const build = (template: EkgTemplate): EkgSuggestion => {
    const finding = template.findings?.find((item) => found.includes(item));
    return {
      id: template.id,
      name: template.name,
      segments: templateSegments(template, numbers, found),
      reason: finding && fillTokens(EKG_FINDINGS[finding].reason, { ...numbers, limit: EKG_FINDINGS[finding].limit }),
      fills: template.fills,
    };
  };
  if (isChild) return EKG_TEMPLATES.filter((template) => template.forChildren).map(build);
  const score = (template: EkgTemplate): number =>
    template.findings
      ? template.findings.some((item) => found.includes(item))
        ? template.rank
        : 0
      : found.length
      ? template.rank
      : template.rankWhenNormal ?? template.rank;
  return EKG_TEMPLATES.map((template) => ({ template, score: score(template) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => build(entry.template));
}

export function ekgSuggestionPicks(suggestion: EkgSuggestion, picks: (string | undefined)[]): EkgInterpretation {
  const choice: Record<string, string> = {};
  suggestion.segments.forEach((segment, i) => {
    if (!isSentenceBlank(segment)) return;
    const blank = segment as EkgSuggestionBlank;
    const word = picks[i] ?? blank.initial ?? '';
    choice[blank.key] = blank.fieldValue?.[word] ?? word.charAt(0).toLowerCase() + word.slice(1);
  });
  const resolve = (value: string): string => fillTokens(value, choice);
  const read: EkgInterpretation = { ...EKG_NORMAL_READ };
  for (const [key, value] of Object.entries(suggestion.fills))
    Object.assign(read, { [key]: Array.isArray(value) ? value.map(resolve) : resolve(value) });
  return read;
}

const sameChoice = (a: StructuredFacts[string], b: string | string[] | undefined): boolean =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((item, i) => item === b[i]) : a === b;

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

export function ekgReminders(facts: StructuredFacts): EkgReminder[] {
  const numbers = ekgMeasurements(facts);
  const found = ekgFindings(numbers);
  const conduction = readStrings(facts, 'conduction');
  const saysNormal = conduction.includes('normal');
  const withFinding = (finding: string): EkgInterpretation => ({
    conduction: [...conduction.filter((item) => item !== 'normal'), finding],
  });
  const findings: string[] = [];
  const reminders: EkgReminder[] = [];
  if (found.includes('longPr')) {
    findings.push('first-degree AV block');
    if (saysNormal)
      reminders.push({
        message: `A PR of ${numbers.pr} ms meets the definition of first-degree AV block; Intervals says "normal".`,
        fixes: [{ label: 'Add first-degree AV block', apply: withFinding('first-degree AV block') }],
      });
  }
  if (found.includes('wideQrs')) {
    findings.push('wide QRS');
    if (saysNormal)
      reminders.push({
        message: `A QRS of ${numbers.qrs} ms is wide, consistent with a bundle branch block or conduction delay; Intervals says "normal".`,
        fixes: ['right bundle branch block', 'left bundle branch block', 'nonspecific conduction delay'].map(
          (finding) => ({ label: `Add ${finding}`, apply: withFinding(finding) })
        ),
      });
  }
  if (found.includes('longQtc')) {
    findings.push('prolonged QTc');
    if (saysNormal)
      reminders.push({
        message: `A QTc of ${numbers.qtc} ms is prolonged; Intervals says "normal".`,
        fixes: [{ label: 'Add prolonged QTc', apply: withFinding('prolonged QTc') }],
      });
  }
  if (findings.length && facts.impression === 'normal EKG')
    reminders.push({
      message: `Impression is "normal EKG", but the numbers show ${findings.join(', ')}.`,
      fixes: ['borderline EKG', 'abnormal EKG'].map((impression) => ({
        label: `Change impression to ${impression}`,
        apply: { impression },
      })),
    });
  return reminders;
}
