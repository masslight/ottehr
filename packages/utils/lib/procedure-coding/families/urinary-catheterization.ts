// Urinary catheterization coding model — functional requirements §10.
// 51701 (straight / in-and-out catheterization) vs 51702 (temporary indwelling catheter,
// e.g. Foley): the documented catheter type is the only within-family determinant. Other
// catheter codes (e.g. 51703 complicated indwelling) are outside scope and are reported
// "not assessed", never guessed.

import { textFlag, textMention } from '../extract';
import {
  CodeCandidate,
  emptyFamilyEvaluation,
  FactValue,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

// ── Catheter types and code table ──────────────────────────────────────────────

/** The catheter type the documented text selects (requirements §10). */
export type UrinaryCatheterType = 'straight' | 'indwelling';

interface UrinaryCatheterCodeInfo {
  type: UrinaryCatheterType;
  display: string;
  /** What the code covers, for mismatch findings. */
  coverage: string;
}

const URINARY_CATHETER_CODE_INFO: Record<string, UrinaryCatheterCodeInfo> = {
  '51701': {
    type: 'straight',
    display: 'Insertion of non-indwelling bladder catheter (eg, straight catheterization for residual urine)',
    coverage: 'a straight (in-and-out) catheterization',
  },
  '51702': {
    type: 'indwelling',
    display: 'Insertion of temporary indwelling bladder catheter; simple (eg, Foley)',
    coverage: 'an indwelling (eg, Foley) catheter insertion',
  },
};

export function isUrinaryCatheterizationCode(code: string): boolean {
  return URINARY_CATHETER_CODE_INFO[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${URINARY_CATHETER_CODE_INFO[code].display}` };
}

const TYPE_LABELS: Record<UrinaryCatheterType, string> = {
  straight: 'a straight (in-and-out) catheterization',
  indwelling: 'an indwelling (Foley) catheter',
};

const CODE_FOR_TYPE: Record<UrinaryCatheterType, string> = { straight: '51701', indwelling: '51702' };

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface UrinaryCatheterizationFacts {
  /** Straight / in-and-out / red-rubber language. */
  straightDocumented?: FactValue<true>;
  /** Indwelling / Foley / retention-catheter language (a balloon inflation also counts). */
  indwellingDocumented?: FactValue<true>;
  /**
   * The catheter type the note pins down; absent when neither is documented or when the
   * note documents both (the conflict is asked about, never guessed at).
   */
  catheterType?: FactValue<UrinaryCatheterType>;
  /** True when both type vocabularies appear — the note must be reconciled, not guessed at. */
  typeConflict: boolean;
  /** Catheter size in French (e.g. "8 Fr"). */
  sizeDocumented?: FactValue<true>;
  /** Why the catheterization was performed (retention, specimen, residual, …). */
  indicationDocumented?: FactValue<true>;
  /** Outcome/tolerance: urine obtained and/or the structured Patient response field. */
  outcomeDocumented: boolean;
}

const STRAIGHT_PATTERN =
  /straight\s+cath\w*|in[-\s]?and[-\s]?out|\bI\s*&\s*O\s+cath\w*|red\s+rubber|non[-\s]?indwelling/i;
// "retention" alone is an indication (urinary retention), so only the bound phrase
// "retention catheter" counts as type evidence here.
const INDWELLING_PATTERN =
  /indwelling|foley|retention\s+cath\w*|balloon\s+(?:inflated|filled)|catheter\s+(?:left\s+in\s+place|secured\s+to)/i;

const SIZE_PATTERN = /\d{1,2}\s*(?:fr\b|french)/i;
const INDICATION_PATTERN =
  /urinary\s+retention|unable\s+to\s+void|obtain\s+(?:a\s+)?(?:urine\s+)?(?:specimen|sample)|urine\s+(?:specimen|sample)|urinalysis|\bUA\b|(?:urine\s+)?culture|residual\s+urine|bladder\s+(?:distension|distention|scan)/i;
// Outcome is result language — "no urine obtained" still documents the outcome, so no negation guard.
const OUTCOME_PATTERN =
  /urine\s+(?:obtained|returned|drained|collected|expressed)|(?:clear|yellow|amber|dark|cloudy|bloody)\s+urine|\d+\s*(?:mL|cc)\b[^.;\n]{0,20}urine|tolerat\w*/i;

/** Deterministic urinary-catheterization fact extraction: structured fields first, then details-text patterns. */
export function extractUrinaryCatheterizationFacts(input: ProcedureFactsInput): UrinaryCatheterizationFacts {
  const text = input.procedureDetails ?? '';

  const straightDocumented = textFlag(text, STRAIGHT_PATTERN);
  const indwellingDocumented = textFlag(text, INDWELLING_PATTERN);
  const typeConflict = straightDocumented !== undefined && indwellingDocumented !== undefined;

  let catheterType: FactValue<UrinaryCatheterType> | undefined;
  if (!typeConflict && straightDocumented) {
    catheterType = {
      value: 'straight',
      confidence: straightDocumented.confidence,
      sourceText: straightDocumented.sourceText,
    };
  } else if (!typeConflict && indwellingDocumented) {
    catheterType = {
      value: 'indwelling',
      confidence: indwellingDocumented.confidence,
      sourceText: indwellingDocumented.sourceText,
    };
  }

  return {
    straightDocumented,
    indwellingDocumented,
    catheterType,
    typeConflict,
    sizeDocumented: textMention(text, SIZE_PATTERN),
    indicationDocumented: textMention(text, INDICATION_PATTERN),
    outcomeDocumented: Boolean(input.patientResponse?.trim()) || textMention(text, OUTCOME_PATTERN) !== undefined,
  };
}

// ── Message building blocks ────────────────────────────────────────────────────

const TYPE_ASK_CLAUSE = 'the catheter type selects the code (51701 straight/in-and-out; 51702 indwelling, e.g. Foley)';

const TYPE_CONFLICT_CLAUSE =
  'the note documents both straight-catheterization and indwelling-catheter language — please reconcile them';

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  type: { destination: TO_DETAILS, example: '"straight catheterization" or "Foley catheter placed"' },
  size: { destination: TO_DETAILS, example: '"8 Fr catheter"' },
  indication: { destination: TO_DETAILS, example: '"unable to void; bladder distended"' },
  outcome: { destination: TO_DETAILS, example: '"300 mL clear yellow urine obtained; tolerated well"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestUrinaryCatheterizationCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractUrinaryCatheterizationFacts(input);
  const evaluation = emptyFamilyEvaluation();

  if (facts.catheterType === undefined) {
    evaluation.findings.push({
      level: 'determines',
      message: facts.typeConflict
        ? `The catheter type is ambiguous — ${TYPE_CONFLICT_CLAUSE}; ${TYPE_ASK_CLAUSE}.`
        : `The catheter type is not documented — ${TYPE_ASK_CLAUSE}. ${whereClause('type')}`,
    });
    evaluation.openCandidates = [codeCandidate('51701'), codeCandidate('51702')];
    evaluation.openCandidatesSummary = '51701–51702 — the catheter type (straight vs indwelling) determines the code';
    return evaluation;
  }

  const type = facts.catheterType.value;
  const code = CODE_FOR_TYPE[type];
  evaluation.suggestion = {
    code,
    display: codeCandidate(code).display,
    justification: `Urinary catheterization — ${TYPE_LABELS[type]} documented → ${code}.`,
  };
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendUrinaryCatheterizationCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractUrinaryCatheterizationFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const documentedType = facts.catheterType?.value;

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    const info = URINARY_CATHETER_CODE_INFO[code];
    if (info === undefined) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Catheter type: the [D] that selects within the family — mismatch is a hard [C] both ways;
    // an ambiguous note gets the reconcile ask, never a guessed contradiction.
    if (facts.typeConflict) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `The catheter type is ambiguous for ${code} — ${TYPE_CONFLICT_CLAUSE}.`,
      });
    } else if (documentedType === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `The catheter type is not documented for ${code} — ${TYPE_ASK_CLAUSE}. ${whereClause('type')}`,
      });
    } else if (documentedType !== info.type) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} covers ${info.coverage}, but the note documents ${TYPE_LABELS[documentedType]} — as documented this supports ${CODE_FOR_TYPE[documentedType]}.`,
        sourceText: facts.catheterType?.sourceText,
        confidence: facts.catheterType?.confidence,
      });
    }

    // [R] elements an auditor expects for either code.
    if (!facts.sizeDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The catheter size is not documented for ${code} — record the French size. ${whereClause('size')}`,
      });
    }
    if (!facts.indicationDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The indication is not documented for ${code} — the note should say why the catheterization was performed. ${whereClause(
          'indication'
        )}`,
      });
    }
    if (!facts.outcomeDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The outcome is not documented for ${code} — record whether urine was obtained and how the patient tolerated it. ${whereClause(
          'outcome'
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

// Matches the product procedure type "Urinary Catheterization" (and its "urinary-catheterization"
// slug). Deliberately narrow: "Intravenous (IV) Catheter Placement" is a different service.
const URINARY_CATHETERIZATION_TYPE_PATTERN = /urinary[\s-]*cath\w*|bladder\s+cath\w*/i;

export const urinaryCatheterizationFamily: ProcedureFamilyModel = {
  id: 'urinary-catheterization',
  displayName: 'Urinary Catheterization',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = URINARY_CATHETERIZATION_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isUrinaryCatheterizationCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractUrinaryCatheterizationFacts,
  suggestCode: suggestUrinaryCatheterizationCode,
  defendCodes: defendUrinaryCatheterizationCodes,
};
