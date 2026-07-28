import { snippetAround, textFlag, textMention } from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFrom,
  defendSelectedCodes,
  DETAILS_FIELD_LABEL,
  DIAGNOSIS_FIELD_LABEL,
  TO_DETAILS,
  whereClauseFor,
} from '../family-support';
import {
  citing,
  codeScope,
  determinedCode,
  emptyDefenseEvaluation,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  textEvidence,
  WhereToDocument,
} from '../model.types';

const EKG_CODES = {
  tracingWithInterpretation: '93000',
  tracingOnly: '93005',
  interpretationOnly: '93010',
} as const;

type EkgCode = (typeof EKG_CODES)[keyof typeof EKG_CODES];

const EKG_CODE_DISPLAYS = {
  [EKG_CODES.tracingWithInterpretation]:
    'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report',
  [EKG_CODES.tracingOnly]:
    'Electrocardiogram, routine ECG with at least 12 leads; tracing only, without interpretation and report',
  [EKG_CODES.interpretationOnly]:
    'Electrocardiogram, routine ECG with at least 12 leads; interpretation and report only',
} as const satisfies Record<EkgCode, string>;

export function isEkgCode(code: string): code is EkgCode {
  return code in EKG_CODE_DISPLAYS;
}

const codeCandidate = codeCandidateFrom(EKG_CODE_DISPLAYS);

const INTERPRETATION_CODES: readonly string[] = [EKG_CODES.tracingWithInterpretation, EKG_CODES.interpretationOnly];

export type EkgInterpretationElement = 'rate' | 'rhythm' | 'axis' | 'intervals' | 'st-t' | 'impression';

const ELEMENT_TABLE: Array<{
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

const FULL_INTERPRETATION_MENU = 'rate, rhythm, axis, intervals, ST-T assessment, and an impression';

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

export function extractEkgFacts(input: ProcedureFactsInput): EkgFacts {
  const text = input.procedureDetails ?? '';

  const elements: EkgFacts['elements'] = {};
  for (const { element, pattern } of ELEMENT_TABLE) {
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

function missingElements(facts: EkgFacts): typeof ELEMENT_TABLE {
  return ELEMENT_TABLE.filter(({ element }) => facts.elements[element] === undefined);
}

function documentedElementLabels(facts: EkgFacts): string {
  return ELEMENT_TABLE.filter(({ element }) => facts.elements[element] !== undefined)
    .map(({ label }) => label)
    .join(', ');
}

const WHERE_TO_DOCUMENT = {
  interpretation: {
    destination: TO_DETAILS,
    example:
      '"Rate 82, NSR, normal axis, PR 160 / QRS 88 / QTc 410 ms, no acute ST-T changes. Impression: normal EKG."',
  },
  indication: {
    destination: `as a structured diagnosis, or describe the indication in ${DETAILS_FIELD_LABEL}`,
    example: '"chest pain"',
  },
  comparison: { destination: TO_DETAILS, example: '"compared to prior EKG — no change" or "no prior available"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function missingElementFinding(entry: (typeof ELEMENT_TABLE)[number], code: string): Finding {
  return {
    level: 'required',
    scope: codeScope(code),
    message: `The interpretation's ${entry.label} is not documented for ${code} — a complete interpretation & report records ${FULL_INTERPRETATION_MENU}. Add it ${TO_DETAILS}, e.g. ${entry.example}.`,
    evidence: NOTHING_TO_CITE,
  };
}

const IN_OFFICE_PREMISE = 'the note does not indicate the tracing was obtained elsewhere';

function limitedLeadMessage(subject: string): string {
  return `${subject} — 93000, 93005 and 93010 are all the routine ECG with at least 12 leads, and the note documents a limited-lead tracing (a rhythm or monitor strip). That is 93040-93042 (rhythm ECG, 1-3 leads), which is outside this model's scope and is not assessed.`;
}

const OPEN_CANDIDATES_SUMMARY =
  '93000, 93005, 93010 — which EKG component the documentation supports (the tracing, the interpretation & report, or both) determines the code';

const CLUSTERED_ELEMENTS_THRESHOLD = 2;

function hasEkgEvidence(facts: EkgFacts, documentedCount: number): boolean {
  return facts.tracingMentionDocumented !== undefined || documentedCount >= CLUSTERED_ELEMENTS_THRESHOLD;
}

function suggestEkgCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractEkgFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const missing = missingElements(facts);
  const documentedCount = ELEMENT_TABLE.length - missing.length;

  if (facts.limitedLeadDocumented) {
    const message = limitedLeadMessage('No code is suggested');
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message,
      evidence: citing(facts.limitedLeadDocumented),
    });
    evaluation.outcome = notAssessedCode(message);
    return evaluation;
  }

  if (documentedCount === 0 && facts.tracingMentionDocumented !== undefined) {
    evaluation.outcome = determinedCode({
      code: EKG_CODES.tracingOnly,
      display: codeCandidate(EKG_CODES.tracingOnly).display,
      justification:
        'A routine EKG tracing with at least 12 leads is documented without an interpretation and report — the documentation supports the tracing-only component → 93005.',
    });
    return evaluation;
  }

  if (documentedCount === 0 || !hasEkgEvidence(facts, documentedCount)) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message:
        documentedCount === 0
          ? `No 12-lead tracing or interpretation & report is documented — the component(s) performed determine the code: 93000 covers both, 93005 the tracing only, and 93010 the interpretation & report only. ${whereClause(
              'interpretation',
              'Document the component(s) performed'
            )}`
          : `The note does not document an EKG tracing or a reading of one — ${documentedElementLabels(
              facts
            )} on its own reads as a vital sign or history rather than an interpretation, so which EKG component the documentation supports is open: 93000 covers the tracing plus the interpretation & report, 93005 the tracing only. ${whereClause(
              'interpretation',
              'Add the interpretation'
            )}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(Object.values(EKG_CODES).map(codeCandidate), OPEN_CANDIDATES_SUMMARY);
    return evaluation;
  }

  const external = facts.externalTracingDocumented !== undefined;
  const code = external ? EKG_CODES.interpretationOnly : EKG_CODES.tracingWithInterpretation;

  if (missing.length === 0) {
    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification: external
        ? `A full interpretation is documented (${FULL_INTERPRETATION_MENU}) of an externally-obtained tracing — the documentation supports the interpretation & report of the existing tracing → 93010.`
        : `A full interpretation is documented (${FULL_INTERPRETATION_MENU}) and ${IN_OFFICE_PREMISE}, so the documentation supports the complete service → 93000.`,
    });
    return evaluation;
  }

  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: external
      ? `An interpretation is documented (${documentedElementLabels(
          facts
        )}) of an externally-obtained tracing — the documentation supports the interpretation & report of the existing tracing → 93010; the missing interpretation elements are listed below.`
      : `An interpretation is documented (${documentedElementLabels(
          facts
        )}) and ${IN_OFFICE_PREMISE}, so the documentation supports the complete service → 93000; the missing interpretation elements are listed below.`,
  });
  for (const entry of missing) {
    findings.push(missingElementFinding(entry, code));
  }
  return evaluation;
}

function defendEkgCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractEkgFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const selectedCodes = selected.map((c) => c.code);
  const missing = missingElements(facts);
  const inScopeSelected = selected.filter((c) => isEkgCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isEkgCode(code) ? code : undefined),
    (_info, code, codeFindings, answerAtEntryLevel) => {
      if (facts.limitedLeadDocumented) {
        findings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: limitedLeadMessage(`${code} is selected`),
          evidence: citing(facts.limitedLeadDocumented),
        });
        answerAtEntryLevel();
        return;
      }

      if (code !== EKG_CODES.tracingWithInterpretation && selectedCodes.includes(EKG_CODES.tracingWithInterpretation)) {
        const component = code === EKG_CODES.tracingOnly ? 'the tracing' : 'the interpretation & report';
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} bills ${component} only, but 93000 is also selected — 93000 already covers the tracing plus the interpretation & report, so adding ${code} double-bills that component.`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (INTERPRETATION_CODES.includes(code)) {
        for (const entry of missing) {
          codeFindings.push(missingElementFinding(entry, code));
        }
      }

      if (code === EKG_CODES.tracingOnly && missing.length === 0) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The note documents a full interpretation (${FULL_INTERPRETATION_MENU}) — 93005 bills the tracing only; 93000 covers the tracing plus the interpretation & report.`,
          evidence: citing(facts.elements.impression),
        });
      }
    }
  );

  if (inScopeSelected.length > 0) {
    if (!facts.indicationDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `The indication for the EKG is not documented. ${whereClause('indication', 'Record it')}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.comparisonDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Comparison to a prior tracing is not documented — note the comparison, or that no prior is available. ${whereClause(
          'comparison',
          'Add it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}

export const ekgFamily: ProcedureFamilyModel = {
  id: 'ekg',
  displayName: 'Diagnostic EKG',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('ekg', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isEkgCode(c.code))
  ),
  suggestCode: suggestEkgCode,
  defendCodes: defendEkgCodes,
};
