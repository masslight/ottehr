import { snippetAround, textFlag, textMention } from '../extract';
import { DIAGNOSIS_FIELD_LABEL } from '../family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';

export type EkgInterpretationElement = 'rate' | 'rhythm' | 'axis' | 'intervals' | 'st-t' | 'impression';

export const EKG_INTERPRETATION_ELEMENTS: Array<{
  element: EkgInterpretationElement;
  label: string;
  pattern: RegExp;
  example: string;
}> = [
  {
    element: 'rate',
    label: 'rate',
    pattern: /\b\d{2,3}\s*bpm\b|\b(?:heart\s+)?rate:?\s*(?:of\s+)?\d{2,3}\b|\bHR:?\s*\d{2,3}\b/i,
    example: '"rate 82"',
  },
  {
    element: 'rhythm',
    label: 'rhythm',
    pattern:
      /\bNSR\b|normal\s+sinus(?:\s+rhythm)?|sinus\s+(?:rhythm|tachy\w*|brady\w*|arrhythmi\w*)|a(?:trial)?[-\s]?fib\w*|atrial\s+flutter|\bSVT\b|junctional\s+rhythm|ventricular\s+(?:tachy\w*|rhythm)|paced\s+rhythm/i,
    example: '"normal sinus rhythm"',
  },
  { element: 'axis', label: 'axis', pattern: /\baxis\b|\bRAD\b/i, example: '"normal axis"' },
  {
    element: 'intervals',
    label: 'intervals (PR/QRS/QTc)',
    pattern: /\bPR\b|\bQRS\b|\bQTc?\b|\bintervals?\b/i,
    example: '"PR 160, QRS 88, QTc 410 ms"',
  },
  {
    element: 'st-t',
    label: 'ST-T assessment',
    pattern: /\bST[-\s]?(?:T\b|segments?\b|elevation|depression|changes?)|\bT[-\s]?waves?\b|\bTWI\b/i,
    example: '"no acute ST-T changes"',
  },
  {
    element: 'impression',
    label: 'impression',
    pattern:
      /\bimpression\b|normal\s+(?:EKG|ECG|electrocardiogram|tracing|study)|abnormal\s+(?:EKG|ECG|electrocardiogram)|no\s+acute\s+(?:ischemi\w*|infarct\w*|process|findings)|within\s+normal\s+limits|nonspecific\s+(?:changes|findings)|consistent\s+with\s+ischemi\w*/i,
    example: '"Impression: normal EKG"',
  },
];

export interface EkgFacts {
  elements: Partial<Record<EkgInterpretationElement, FactValue<true>>>;
  tracingMentionDocumented?: FactValue<true>;
  limitedLeadDocumented?: FactValue<true>;
  indicationDocumented?: FactValue<true>;
  comparisonDocumented?: FactValue<true>;
  externalTracingDocumented?: FactValue<true>;
}

const HISTORY_CUE_PATTERN =
  /\b(?:histor\w*|h\/o|hx|known|prior|previous|past|chronic|recurrent|reports?|denies|complain\w*)\b/i;

const INDICATION_PATTERN =
  /chest\s+pain|palpitat\w*|syncope|dizz\w*|shortness\s+of\s+breath|\bSOB\b|pre-?op\w*|\bindication:?\b/i;

const COMPARISON_PATTERN =
  /compar(?:ed|ison)\b|prior\s+(?:EKG|ECG|tracing)|previous\s+(?:EKG|ECG|tracing)|no\s+prior(?:\s+(?:EKG|ECG|tracing))?\s+(?:available|for\s+comparison)|baseline\s+(?:EKG|ECG)/i;

const EXTERNAL_TRACING_PATTERN =
  /\bover-?read\b|tracing\s+(?:was\s+)?(?:obtained|performed|done|recorded)\s+(?:at|by|elsewhere|outside|previously)|interpretation\s+(?:and|&)\s+report\s+only/i;

const TRACING_MENTION_PATTERN = /\bEKGs?\b|\bECGs?\b|electrocardiogram|\btracings?\b|\d{1,2}[-\s]?leads?\b/i;

const LIMITED_LEAD_PATTERN =
  /\b[1-6][-\s]?leads?\b|\bsingle[-\s]?lead\b|(?:rhythm|telemetry|monitor|cardiac\s+monitor)\s+strip|\bstrip\s+(?:only|obtained|printed)\b/i;

const TWELVE_LEAD_PATTERN = /\b(?:1[2-8])[-\s]?leads?\b|standard\s+leads/i;

function isHistoryBound(text: string, index: number): boolean {
  const clauseStart =
    Math.max(text.lastIndexOf('.', index), text.lastIndexOf(';', index), text.lastIndexOf('\n', index)) + 1;
  return HISTORY_CUE_PATTERN.test(text.slice(clauseStart, index));
}

function interpretationMention(text: string, pattern: RegExp): FactValue<true> | undefined {
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    if (!isHistoryBound(text, result.index)) {
      return { value: true, evidence: textEvidence(snippetAround(text, result.index, result[0].length)) };
    }
  }
  return undefined;
}

export function extractEkgFacts(input: ProcedureFactsInput): EkgFacts {
  const text = input.procedureDetails ?? '';
  const elements: EkgFacts['elements'] = {};
  for (const { element, pattern } of EKG_INTERPRETATION_ELEMENTS) {
    const found = interpretationMention(text, pattern);
    if (found) elements[element] = found;
  }
  const twelveLead = textFlag(text, TWELVE_LEAD_PATTERN);

  return {
    elements,
    tracingMentionDocumented: interpretationMention(text, TRACING_MENTION_PATTERN),
    limitedLeadDocumented: twelveLead ? undefined : textFlag(text, LIMITED_LEAD_PATTERN),
    indicationDocumented:
      (input.diagnoses ?? []).length > 0
        ? { value: true, evidence: fieldEvidence(DIAGNOSIS_FIELD_LABEL) }
        : textMention(text, INDICATION_PATTERN),
    comparisonDocumented: textMention(text, COMPARISON_PATTERN),
    externalTracingDocumented: textMention(text, EXTERNAL_TRACING_PATTERN),
  };
}
