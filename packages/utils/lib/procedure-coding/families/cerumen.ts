// Impacted cerumen removal coding model — functional requirements §6.5.
// Single code in scope: 69210 (removal of impacted cerumen requiring instrumentation,
// unilateral). Instrumentation is the code definition — irrigation/lavage alone documented
// contradicts 69210 (69209 territory, kept as a payer footnote). 69209 itself and any other
// selected code are outside scope and are reported "not assessed", never guessed.

import { textFlag } from '../extract';
import {
  emptyFamilyEvaluation,
  FactValue,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface CerumenFacts {
  /** Removal by instrumentation (curette, cerumen loop, micro-suction, forceps), from Technique values or text. */
  instrumentationDocumented?: FactValue<true>;
  /** Removal by irrigation/lavage, from Technique values or text. */
  irrigationDocumented?: FactValue<true>;
  /** Documented impaction: an impacted-cerumen diagnosis (H61.2x) or impaction language in the text. */
  impactionDocumented?: FactValue<true>;
  /** Post-procedure exam (canal clear / TM intact). */
  postExamDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

const INSTRUMENTATION_PATTERN =
  /curett?(?:e|es|age|ed)\b|cerumen\s+(?:loop|spoon|hook)|wire\s+loop|micro[-\s]?suction|suction\w*|forceps|alligator|\binstrument(?:ation|s)?\b/i;
const IRRIGATION_PATTERN = /irrigat\w*|lavage|flush\w*|syring(?:e|ed|ing)\b|water\s*pik|rins\w*/i;
const IMPACTION_TEXT_PATTERN = /impact(?:ed|ion)\b/i;
const POST_EXAM_PATTERN =
  /canal\s+(?:is\s+|was\s+|now\s+)?clear|clear\s+(?:external\s+)?(?:auditory\s+)?canal|(?:tympanic\s+membrane|\bTM\b)[^.;\n]{0,30}\b(?:intact|normal|clear|visualized)|intact\s+(?:tympanic\s+membrane|\bTM\b)/i;

/** ICD-10 H61.2x — impacted cerumen (with or without the dot, either ear). */
const IMPACTED_CERUMEN_DX_PATTERN = /^H61\.?2/i;

function methodFlag(input: ProcedureFactsInput, text: string, pattern: RegExp): FactValue<true> | undefined {
  if ((input.technique ?? []).some((value) => pattern.test(value))) {
    return { value: true, confidence: 'structured' };
  }
  return textFlag(text, pattern);
}

/** Deterministic cerumen-removal fact extraction: structured fields first, then details-text patterns. */
export function extractCerumenFacts(input: ProcedureFactsInput): CerumenFacts {
  const text = input.procedureDetails ?? '';
  const impactedDx = (input.diagnoses ?? []).some(
    (dx) => IMPACTED_CERUMEN_DX_PATTERN.test(dx.code) || /impacted\s+cerumen|cerumen\s+impaction/i.test(dx.display)
  );

  return {
    instrumentationDocumented: methodFlag(input, text, INSTRUMENTATION_PATTERN),
    irrigationDocumented: methodFlag(input, text, IRRIGATION_PATTERN),
    impactionDocumented: impactedDx
      ? { value: true, confidence: 'structured' }
      : textFlag(text, IMPACTION_TEXT_PATTERN),
    postExamDocumented: textFlag(text, POST_EXAM_PATTERN),
    lateralityDocumented: Boolean(input.bodySide),
  };
}

// ── Code, payer notes, and message building blocks ─────────────────────────────

const CERUMEN_CODE_DISPLAY = 'Removal impacted cerumen requiring instrumentation, unilateral';

export function isCerumenRemovalCode(code: string): boolean {
  return code === '69210';
}

export const CERUMEN_IRRIGATION_PAYER_NOTE =
  'Payer note: cerumen removal by irrigation/lavage alone is reported with 69209, not 69210; coverage for 69209 varies by payer.';
export const CERUMEN_BILATERAL_PAYER_NOTE =
  'Payer note: 69210 is unilateral per current CPT; how bilateral removal is billed varies by payer.';

/** The qualifying-instrumentation menu, spelled out in plain language for findings. */
const INSTRUMENTATION_MENU = 'curette, cerumen loop, micro-suction, or forceps';

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  method: { destination: TO_DETAILS, example: '"cerumen removed with curette under direct visualization"' },
  impaction: {
    destination: `as an impacted-cerumen diagnosis (H61.2x), or describe the impaction in ${DETAILS_FIELD_LABEL}`,
    example: '"canal completely occluded by impacted cerumen"',
  },
  laterality: { destination: 'in the Side of body field' },
  postExam: { destination: TO_DETAILS, example: '"canal clear, TM intact"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestCerumenCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractCerumenFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings } = evaluation;

  // Instrumentation governs even when irrigation is also documented.
  if (facts.instrumentationDocumented) {
    evaluation.suggestion = {
      code: '69210',
      display: `69210 — ${CERUMEN_CODE_DISPLAY}`,
      justification: `Impacted cerumen removal by instrumentation documented${
        facts.irrigationDocumented ? ' (irrigation is also documented — the instrumentation governs)' : ''
      } → 69210.`,
    };
    return evaluation;
  }

  if (facts.irrigationDocumented) {
    findings.push({
      level: 'contradiction',
      message: `The note documents cerumen removal by irrigation/lavage alone — irrigation alone does not qualify for 69210, which is defined by instrumentation (${INSTRUMENTATION_MENU}). ${whereClause(
        'method',
        'If an instrument was also used, add it'
      )}`,
      sourceText: facts.irrigationDocumented.sourceText,
      confidence: facts.irrigationDocumented.confidence,
    });
    evaluation.payerNotes = [CERUMEN_IRRIGATION_PAYER_NOTE];
    return evaluation;
  }

  findings.push({
    level: 'determines',
    message: `The removal method is not documented — 69210 requires removal by instrumentation (${INSTRUMENTATION_MENU}); irrigation alone does not qualify. ${whereClause(
      'method'
    )}`,
  });
  evaluation.openCandidates = [{ code: '69210', display: `69210 — ${CERUMEN_CODE_DISPLAY}` }];
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendCerumenCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractCerumenFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    if (!isCerumenRemovalCode(code)) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Method: the code definition, checked first.
    if (!facts.instrumentationDocumented) {
      if (facts.irrigationDocumented) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `69210 is selected, but the note documents cerumen removal by irrigation/lavage alone — irrigation alone does not qualify for 69210, which is defined by instrumentation (${INSTRUMENTATION_MENU}). ${whereClause(
            'method',
            'If an instrument was also used, add it'
          )}`,
          sourceText: facts.irrigationDocumented.sourceText,
          confidence: facts.irrigationDocumented.confidence,
        });
        evaluation.payerNotes = [CERUMEN_IRRIGATION_PAYER_NOTE];
      } else {
        codeFindings.push({
          level: 'determines',
          cptCode: code,
          message: `The removal method is not documented for 69210 — it requires removal by instrumentation (${INSTRUMENTATION_MENU}); irrigation alone does not qualify. ${whereClause(
            'method'
          )}`,
        });
      }
    }

    if (!facts.impactionDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Cerumen impaction is not documented — payers require documented impaction, not routine wax removal, to support 69210. ${whereClause(
          'impaction'
        )}`,
      });
    }
    if (!facts.lateralityDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Laterality is not documented for 69210. ${whereClause('laterality', 'Select it')}`,
        payerNote: CERUMEN_BILATERAL_PAYER_NOTE,
      });
    }
    if (!facts.postExamDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `A post-procedure exam is not documented for 69210 — note that the canal is clear and the TM intact. ${whereClause(
          'postExam'
        )}`,
      });
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(code);
    }
    findings.push(...codeFindings);
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

// Matches the product procedure type "Ear Lavage / Cerumen Removal" (and its "ear-lavage" code slug).
const CERUMEN_TYPE_PATTERN = /cerumen|ear[\s-]*wax|ear[\s-]+lavage/i;

export const cerumenFamily: ProcedureFamilyModel = {
  id: 'cerumen',
  displayName: 'Impacted Cerumen Removal',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = CERUMEN_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isCerumenRemovalCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractCerumenFacts,
  suggestCode: suggestCerumenCode,
  defendCodes: defendCerumenCodes,
};
