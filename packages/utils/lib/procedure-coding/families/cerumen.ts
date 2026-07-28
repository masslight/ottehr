import { lateralityDocumented, techniqueOrTextFlag, textFlag, textMention, TM_INTACT_PATTERN } from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFrom,
  defendSelectedCodes,
  DETAILS_FIELD_LABEL,
  DIAGNOSIS_FIELD_LABEL,
  lateralityFinding,
  SIDE_FIELD_LABEL,
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
  ifPerformedClause,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
} from '../model.types';

export interface CerumenFacts {
  instrumentationDocumented?: FactValue<true>;
  irrigationDocumented?: FactValue<true>;
  impactionDocumented?: FactValue<true>;
  impactionDeniedDocumented?: FactValue<true>;
  bilateralDocumented?: FactValue<true>;
  postExamDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

const INSTRUMENTATION_PATTERN =
  /curett?(?:e|es|age|ed)\b|cerumen\s+(?:loop|spoon|hook)|wire\s+loop|micro[-\s]?suction\w*|suction\w*[^.;\n]{0,20}(?:cerumen|wax|canal|\bear\b)|(?:cerumen|wax|canal)[^.;\n]{0,20}suction(?:ed|ing)?\b|forceps|alligator|\binstrumentation\b/i;

const IRRIGATION_PATTERN = /irrigat\w*|lavage|flush\w*|syring(?:e|ed|ing)\b|water\s*pik|rins\w*/i;

const IMPACTION_TEXT_PATTERN = /impact(?:ed|ion)\b/i;

const IMPACTION_DENIED_PATTERN =
  /\b(?:no|not|without|w\/o|denies|denied)\b[^.;\n]{0,24}?impact(?:ed|ion)\b|impact(?:ed|ion)\b[^.;\n]{0,16}?\b(?:absent|not\s+(?:present|seen|noted|appreciated))\b|non-?impacted/i;

const POST_EXAM_PATTERN = new RegExp(
  [
    String.raw`canals?\s+(?:is\s+|was\s+|are\s+|were\s+|now\s+)?clear`,
    String.raw`clear\s+(?:external\s+)?(?:auditory\s+)?canals?\b`,
    TM_INTACT_PATTERN.source,
  ].join('|'),
  'i'
);

const IMPACTED_CERUMEN_DX_PATTERN = /^H61\.?2/i;

const BILATERAL_SIDE_PATTERN = /bilateral|both/i;

const BILATERAL_TEXT_PATTERN =
  /bilateral(?:ly)?\b|both\s+(?:ears?|canals?)\s+(?:\w+\s+){0,2}?(?:irrigated|lavaged|flushed|curetted|suctioned)|(?:irrigated|lavaged|flushed|curetted|suctioned|removed)\s+(?:\w+\s+){0,3}?both\s+(?:ears?|canals?)/i;

function extractBilateral(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  if (input.bodySide && BILATERAL_SIDE_PATTERN.test(input.bodySide)) {
    return { value: true, evidence: fieldEvidence(SIDE_FIELD_LABEL) };
  }
  return textFlag(text, BILATERAL_TEXT_PATTERN);
}

export function extractCerumenFacts(input: ProcedureFactsInput): CerumenFacts {
  const text = input.procedureDetails ?? '';
  const impactedDx = (input.diagnoses ?? []).some(
    (dx) => IMPACTED_CERUMEN_DX_PATTERN.test(dx.code) || /impacted\s+cerumen|cerumen\s+impaction/i.test(dx.display)
  );

  return {
    instrumentationDocumented: techniqueOrTextFlag(input, text, INSTRUMENTATION_PATTERN),
    irrigationDocumented: techniqueOrTextFlag(input, text, IRRIGATION_PATTERN),
    impactionDocumented: impactedDx
      ? { value: true, evidence: fieldEvidence(DIAGNOSIS_FIELD_LABEL) }
      : textFlag(text, IMPACTION_TEXT_PATTERN),
    impactionDeniedDocumented: textMention(text, IMPACTION_DENIED_PATTERN),
    bilateralDocumented: extractBilateral(input, text),
    postExamDocumented: textFlag(text, POST_EXAM_PATTERN),
    lateralityDocumented: lateralityDocumented(input, text),
  };
}

const CERUMEN_CODES = {
  irrigation: '69209',
  instrumentation: '69210',
} as const;

type CerumenCode = (typeof CERUMEN_CODES)[keyof typeof CERUMEN_CODES];

const CERUMEN_CODE_DISPLAYS = {
  [CERUMEN_CODES.irrigation]: 'Removal impacted cerumen using irrigation and/or lavage, unilateral',
  [CERUMEN_CODES.instrumentation]: 'Removal impacted cerumen requiring instrumentation, unilateral',
} as const satisfies Record<CerumenCode, string>;

export function isCerumenRemovalCode(code: string): code is CerumenCode {
  return code in CERUMEN_CODE_DISPLAYS;
}

const codeCandidate = codeCandidateFrom(CERUMEN_CODE_DISPLAYS);

export const CERUMEN_IRRIGATION_PAYER_NOTE =
  'Payer note: cerumen removal by irrigation/lavage alone is reported with 69209, not 69210; coverage for 69209 varies by payer.';

export const CERUMEN_BILATERAL_PAYER_NOTE =
  'Payer note: 69209 and 69210 are unilateral per current CPT; how bilateral removal is billed varies by payer.';

const INSTRUMENTATION_MENU = 'curette, cerumen loop, micro-suction, or forceps';

type CerumenMethod = 'instrumentation' | 'irrigation';

function resolveMethod(facts: CerumenFacts): CerumenMethod | undefined {
  if (facts.instrumentationDocumented) return 'instrumentation';
  if (facts.irrigationDocumented) return 'irrigation';
  return undefined;
}

function codeForMethod(method: CerumenMethod): CerumenCode {
  return method === 'instrumentation' ? CERUMEN_CODES.instrumentation : CERUMEN_CODES.irrigation;
}

const WHERE_TO_DOCUMENT = {
  method: { destination: TO_DETAILS, example: '"cerumen removed with curette under direct visualization"' },
  impaction: {
    destination: `as an impacted-cerumen diagnosis (H61.2x), or describe the impaction in ${DETAILS_FIELD_LABEL}`,
    example: '"canal completely occluded by impacted cerumen"',
  },
  laterality: { destination: 'in the Side of body field' },
  postExam: { destination: TO_DETAILS, example: '"canal clear, TM intact"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function methodAskMessage(code?: string): string {
  if (code === CERUMEN_CODES.irrigation) {
    return `The removal method is not documented for 69209 — it is defined by removal using irrigation/lavage, while removal requiring instrumentation (${INSTRUMENTATION_MENU}) is 69210. ${whereClause(
      'method'
    )}`;
  }

  const subject = code === undefined ? '' : ` for ${code}`;

  return `The removal method is not documented${subject} — 69210 requires removal by instrumentation (${INSTRUMENTATION_MENU}), while irrigation/lavage alone is 69209. ${whereClause(
    'method'
  )}`;
}

function irrigationAloneMessage(prefix: string): string {
  return `${prefix} — irrigation alone does not qualify for 69210, which is defined by instrumentation (${INSTRUMENTATION_MENU}); as documented the method supports 69209. ${whereClause(
    'method',
    ifPerformedClause('also used', 'add it', 'an instrument')
  )}`;
}

function instrumentationGovernsMessage(): string {
  return `69209 is selected, but the note documents removal by instrumentation (${INSTRUMENTATION_MENU}) — instrumentation governs even when irrigation is also documented, so as documented this supports 69210. ${whereClause(
    'method',
    'If the removal was irrigation/lavage only, say so'
  )}`;
}

function impactionAskMessage(subject: string): string {
  return `Cerumen impaction is not documented — payers require documented impaction, not routine wax removal, to support ${subject}. ${whereClause(
    'impaction'
  )}`;
}

function impactionDeniedMessage(subject: string): string {
  return `The note states that the cerumen was not impacted — ${subject} covers removal of impacted cerumen, and routine wax removal is part of the visit (E/M) charge. ${whereClause(
    'impaction',
    'If it was impacted, record it'
  )}`;
}

const BILATERAL_MESSAGE =
  'Bilateral cerumen removal is documented — 69209 and 69210 are unilateral codes, so how the second side is reported is a payer question.';

const BOTH_CODES = '69209 and 69210';

function addPayerNote(evaluation: FamilyEvaluation, note: string): void {
  if (!evaluation.payerNotes.includes(note)) evaluation.payerNotes.push(note);
}

function noteBilateralRemoval(evaluation: FamilyEvaluation, facts: CerumenFacts): void {
  if (!facts.bilateralDocumented) return;
  evaluation.findings.push({
    level: 'bestPractice',
    scope: ENTRY_SCOPE,
    message: BILATERAL_MESSAGE,
    evidence: citing(facts.bilateralDocumented),
    payerNote: CERUMEN_BILATERAL_PAYER_NOTE,
  });
  addPayerNote(evaluation, CERUMEN_BILATERAL_PAYER_NOTE);
}

function suggestCerumenCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractCerumenFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  if (facts.impactionDeniedDocumented && !facts.impactionDocumented) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: impactionDeniedMessage(BOTH_CODES),
      evidence: citing(facts.impactionDeniedDocumented),
    });
    return evaluation;
  }

  noteBilateralRemoval(evaluation, facts);
  const method = resolveMethod(facts);

  if (method === undefined) {
    findings.push({ level: 'determines', scope: ENTRY_SCOPE, message: methodAskMessage(), evidence: NOTHING_TO_CITE });
    if (!facts.impactionDocumented) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: impactionAskMessage(BOTH_CODES),
        evidence: NOTHING_TO_CITE,
      });
    }
    evaluation.outcome = openCodeSet(
      [codeCandidate(CERUMEN_CODES.irrigation), codeCandidate(CERUMEN_CODES.instrumentation)],
      '69209–69210 — the removal method (irrigation/lavage vs instrumentation) determines the code'
    );
    return evaluation;
  }

  const code = codeForMethod(method);
  if (method === 'irrigation') {
    addPayerNote(evaluation, CERUMEN_IRRIGATION_PAYER_NOTE);
  }

  if (!facts.impactionDocumented) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: impactionAskMessage(code),
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      [codeCandidate(code)],
      `${code} only — it applies only if impacted cerumen is documented; routine wax removal is part of the visit (E/M) charge`
    );

    return evaluation;
  }

  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification:
      method === 'instrumentation'
        ? `Impacted cerumen removal by instrumentation documented${
            facts.irrigationDocumented ? ' (irrigation is also documented — the instrumentation governs)' : ''
          } → 69210.`
        : 'Impacted cerumen removed by irrigation/lavage with no instrumentation documented → 69209.',
  });

  return evaluation;
}

function defendCerumenCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractCerumenFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const method = resolveMethod(facts);

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isCerumenRemovalCode(code) ? code : undefined),
    (_info, code, codeFindings) => {
      if (method === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: methodAskMessage(code),
          evidence: NOTHING_TO_CITE,
        });
      } else if (code === CERUMEN_CODES.instrumentation && method === 'irrigation') {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: irrigationAloneMessage(
            '69210 is selected, but the note documents cerumen removal by irrigation/lavage alone'
          ),
          evidence: citing(facts.irrigationDocumented),
        });
        addPayerNote(evaluation, CERUMEN_IRRIGATION_PAYER_NOTE);
      } else if (code === CERUMEN_CODES.irrigation && method === 'instrumentation') {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: instrumentationGovernsMessage(),
          evidence: citing(facts.instrumentationDocumented),
        });
      }

      if (!facts.impactionDocumented) {
        if (facts.impactionDeniedDocumented) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: impactionDeniedMessage(code),
            evidence: citing(facts.impactionDeniedDocumented),
          });
        } else {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: impactionAskMessage(code),
            evidence: NOTHING_TO_CITE,
          });
        }
      }

      if (!facts.lateralityDocumented) {
        codeFindings.push(
          lateralityFinding(code, whereClause('laterality', 'Select it'), '69209 and 69210 are unilateral codes')
        );
      }

      if (!facts.postExamDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `A post-procedure exam is not documented for ${code} — note that the canal is clear and the TM intact. ${whereClause(
            'postExam'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (selected.some((c) => isCerumenRemovalCode(c.code))) {
    noteBilateralRemoval(evaluation, facts);
  }

  return evaluation;
}

export const cerumenFamily: ProcedureFamilyModel = {
  id: 'cerumen',
  displayName: 'Impacted Cerumen Removal',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('cerumen', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isCerumenRemovalCode(c.code))
  ),
  suggestCode: suggestCerumenCode,
  defendCodes: defendCerumenCodes,
};
