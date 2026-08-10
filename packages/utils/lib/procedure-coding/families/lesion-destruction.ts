// Wart / benign lesion destruction (cryotherapy) coding model — functional requirements §9.
// 17110 (up to 14 lesions) vs 17111 (15 or more): the documented lesion count is the only
// within-family determinant. Other destruction codes (e.g. 17000 premalignant lesions) are
// outside scope and are reported "not assessed", never guessed.

import { firstMatch, snippetAround, textFlag } from '../extract';
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

// ── Codes ──────────────────────────────────────────────────────────────────────

const LESION_DESTRUCTION_CODE_DISPLAYS: Record<string, string> = {
  '17110': 'Destruction (eg, cryosurgery) of benign lesions other than skin tags; up to 14 lesions',
  '17111': 'Destruction (eg, cryosurgery) of benign lesions other than skin tags; 15 or more lesions',
};

/** 17110 covers up to this many lesions; one more selects 17111. */
export const LESION_COUNT_BOUNDARY = 14;

export function isLesionDestructionCode(code: string): boolean {
  return LESION_DESTRUCTION_CODE_DISPLAYS[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${LESION_DESTRUCTION_CODE_DISPLAYS[code]}` };
}

function codeForCount(count: number): string {
  return count <= LESION_COUNT_BOUNDARY ? '17110' : '17111';
}

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface LesionDestructionFacts {
  /** The number of lesions treated, parsed from the details text. */
  lesionCount?: FactValue<number>;
  /** Destruction method (cryotherapy / liquid nitrogen), from Technique values or text. */
  methodDocumented?: FactValue<true>;
  /** Treated locations: the structured body-site fields, or lesion-location language in the text. */
  locationsDocumented: boolean;
}

const LESION_WORDS_SOURCE = String.raw`lesions?|warts?|verruca[es]?|verruca|molluscum|papillomas?`;

// Count shapes, tried in order (the most explicit first):
//   "lesion count: 12", "warts x12", "lesions × 12"
const LESION_WORD_THEN_COUNT_PATTERN = new RegExp(
  String.raw`(?:${LESION_WORDS_SOURCE})\s*(?:[x×#]|count:?)\s*(\d+)\b`,
  'i'
);
//   "12 lesions", "12 plantar warts" — the lookbehind keeps "4-0" style figures out, and the
//   unit guard inside the gap keeps sizes ("a 2 cm lesion") from being read as counts.
const COUNT_THEN_LESION_WORD_PATTERN = new RegExp(
  String.raw`(?<![\d/–-])(\d+)\s+(?:(?!(?:cm|mm)\b)[\w–-]+\s+){0,3}?(?:${LESION_WORDS_SOURCE})\b`,
  'i'
);
//   "a single wart", "one lesion"
const SINGLE_LESION_PATTERN = new RegExp(
  String.raw`\b(?:a\s+single|single|one)\s+(?:[\w–-]+\s+){0,2}?(?:lesion|wart|verruca)\b`,
  'i'
);
//   bare "x12" shorthand — the unit guard keeps dimensions ("2 x 4 cm") from being read as counts.
const BARE_X_COUNT_PATTERN = /(?<![\d.,–-])[x×]\s*(\d+)(?!\s*\.?\d*\s*(?:cm|mm|%))/i;

function extractLesionCount(text: string): FactValue<number> | undefined {
  for (const pattern of [LESION_WORD_THEN_COUNT_PATTERN, COUNT_THEN_LESION_WORD_PATTERN, BARE_X_COUNT_PATTERN]) {
    const result = new RegExp(pattern.source, pattern.flags).exec(text);
    if (result !== null) {
      const count = parseInt(result[1], 10);
      if (Number.isFinite(count) && count > 0) {
        return { value: count, confidence: 'text', sourceText: snippetAround(text, result.index, result[0].length) };
      }
    }
  }
  const single = firstMatch(text, SINGLE_LESION_PATTERN);
  if (single) {
    return { value: 1, confidence: 'text', sourceText: snippetAround(text, single.index, single.match.length) };
  }
  return undefined;
}

const CRYO_METHOD_PATTERN = /cryotherap\w*|cryosurg\w*|\bcryo\b|liquid\s+nitrogen|\bLN2?\b|freez\w*|frozen/i;
// Lesion-location language in the details, when the structured body-site fields are empty.
const LESION_LOCATION_PATTERN = new RegExp(
  String.raw`(?:${LESION_WORDS_SOURCE})[^.;\n]{0,30}\b(?:on|of|over|at)\b|\b(?:plantar|periungual|palmar|dorsal)\b`,
  'i'
);

/** Deterministic lesion-destruction fact extraction: structured fields first, then details-text patterns. */
export function extractLesionDestructionFacts(input: ProcedureFactsInput): LesionDestructionFacts {
  const text = input.procedureDetails ?? '';
  const methodFromTechnique = (input.technique ?? []).some((value) => CRYO_METHOD_PATTERN.test(value));

  return {
    lesionCount: extractLesionCount(text),
    methodDocumented: methodFromTechnique
      ? { value: true, confidence: 'structured' }
      : textFlag(text, CRYO_METHOD_PATTERN),
    locationsDocumented:
      Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) ||
      firstMatch(text, LESION_LOCATION_PATTERN) !== undefined,
  };
}

// ── Message building blocks ────────────────────────────────────────────────────

const COUNT_ASK_CLAUSE =
  'the number of lesions treated selects the code (17110 covers up to 14 lesions; 17111 is 15 or more)';

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  count: { destination: TO_DETAILS, example: '"12 warts treated with liquid nitrogen"' },
  method: { destination: TO_DETAILS, example: '"liquid nitrogen applied to each lesion, two freeze-thaw cycles"' },
  locations: { destination: 'in the Site/location field, or describe the treated locations in Procedure details' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestLesionDestructionCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLesionDestructionFacts(input);
  const evaluation = emptyFamilyEvaluation();

  if (facts.lesionCount === undefined) {
    evaluation.findings.push({
      level: 'determines',
      message: `The number of lesions treated is not documented — ${COUNT_ASK_CLAUSE}. ${whereClause('count')}`,
    });
    evaluation.openCandidates = [codeCandidate('17110'), codeCandidate('17111')];
    evaluation.openCandidatesSummary = '17110–17111 — the number of lesions treated determines the code';
    return evaluation;
  }

  const count = facts.lesionCount.value;
  const code = codeForCount(count);
  evaluation.suggestion = {
    code,
    display: codeCandidate(code).display,
    justification: `Benign lesion destruction — ${count} lesion${count === 1 ? '' : 's'} documented (${
      code === '17110' ? 'up to 14' : '15 or more'
    }) → ${code}.`,
  };
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendLesionDestructionCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLesionDestructionFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const count = facts.lesionCount?.value;

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    if (!isLesionDestructionCode(code)) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Lesion count: the [D] that selects within the family — mismatch is a hard [C] both ways.
    if (count === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `The number of lesions treated is not documented for ${code} — ${COUNT_ASK_CLAUSE}. ${whereClause(
          'count'
        )}`,
      });
    } else if (code === '17111' && count <= LESION_COUNT_BOUNDARY) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `17111 covers 15 or more lesions, but the note documents ${count} — as documented this supports 17110 (up to 14 lesions).`,
        sourceText: facts.lesionCount?.sourceText,
        confidence: facts.lesionCount?.confidence,
      });
    } else if (code === '17110' && count > LESION_COUNT_BOUNDARY) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `17110 covers up to 14 lesions, but the note documents ${count} — as documented this supports 17111 (15 or more lesions).`,
        sourceText: facts.lesionCount?.sourceText,
        confidence: facts.lesionCount?.confidence,
      });
    }

    // [R] elements an auditor expects for either code.
    if (!facts.methodDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The destruction method is not documented for ${code} — the note should say how the lesions were destroyed (e.g. liquid nitrogen). ${whereClause(
          'method'
        )}`,
      });
    }
    if (!facts.locationsDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The treated locations are not documented for ${code}. ${whereClause('locations', 'Record them')}`,
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

// Matches the product procedure type "Wart Treatment (Cryotherapy with Liquid Nitrogen" (and its
// "wart-treatment" slug) plus the 17110 CPT descriptor shape ("Destruction …, of benign lesions …").
// "Tick or Insect Removal" stays foreign-body vocabulary and must never match here.
const LESION_DESTRUCTION_TYPE_PATTERN =
  /\bwarts?\b|cryotherap\w*|cryosurg\w*|liquid\s+nitrogen|\bLN2\b|destruction[^.;\n]{0,80}benign\s+lesions|lesion\s+destruction/i;

export const lesionDestructionFamily: ProcedureFamilyModel = {
  id: 'lesion-destruction',
  displayName: 'Wart / Benign Lesion Destruction',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = LESION_DESTRUCTION_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isLesionDestructionCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractLesionDestructionFacts,
  suggestCode: suggestLesionDestructionCode,
  defendCodes: defendLesionDestructionCodes,
};
