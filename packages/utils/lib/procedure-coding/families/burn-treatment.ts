// Burn treatment / dressing coding model — functional requirements §8.
// 16020 (small, <5% TBSA) vs 16025 (medium, 5–10% TBSA) vs 16030 (large, >10% TBSA):
// the treated burn's extent is the only within-family determinant, read as a documented
// TBSA/BSA percentage or as the CPT size-class language (small/medium/large, whole
// face/extremity, more than one extremity). Other burn codes (e.g. 16000 initial
// first-degree treatment) are outside scope and are reported "not assessed", never guessed.

import { extractSite, firstMatch, snippetAround, suppliesContain, textFlag, textMention } from '../extract';
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

// ── Extent classes and code table ──────────────────────────────────────────────

/** The size class the documented extent selects (requirements §8). */
export type BurnExtentClass = 'small' | 'medium' | 'large';

interface BurnClassInfo {
  code: string;
  display: string;
  /** What the class covers, for justification and mismatch findings. */
  coverage: string;
}

const BURN_CLASS_INFO: Record<BurnExtentClass, BurnClassInfo> = {
  small: {
    code: '16020',
    display: 'Dressings and/or debridement of partial-thickness burns; small (less than 5% total body surface area)',
    coverage: 'less than 5% TBSA',
  },
  medium: {
    code: '16025',
    display:
      'Dressings and/or debridement of partial-thickness burns; medium (eg, whole face or whole extremity, or 5% to 10% total body surface area)',
    coverage: '5% to 10% TBSA',
  },
  large: {
    code: '16030',
    display:
      'Dressings and/or debridement of partial-thickness burns; large (eg, more than 1 extremity, or greater than 10% total body surface area)',
    coverage: 'greater than 10% TBSA',
  },
};

const CLASS_FOR_CODE: Record<string, BurnExtentClass> = Object.fromEntries(
  (Object.entries(BURN_CLASS_INFO) as Array<[BurnExtentClass, BurnClassInfo]>).map(([cls, info]) => [info.code, cls])
);

export function isBurnTreatmentCode(code: string): boolean {
  return CLASS_FOR_CODE[code] !== undefined;
}

function codeCandidate(cls: BurnExtentClass): CodeCandidate {
  const info = BURN_CLASS_INFO[cls];
  return { code: info.code, display: `${info.code} — ${info.display}` };
}

/** The documented TBSA percentage maps to the class exactly as the CPT descriptors band it. */
export function burnClassForPercent(percent: number): BurnExtentClass {
  if (percent < 5) return 'small';
  if (percent <= 10) return 'medium';
  return 'large';
}

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface BurnFacts {
  /** The size class the documented extent selects; absent when the note pins no extent. */
  extentClass?: FactValue<BurnExtentClass>;
  /** The documented TBSA percentage, present only when the extent came from a percentage figure. */
  tbsaPercent?: number;
  /** Burn location: the structured body-site fields, or a recognized site keyword in the text. */
  locationDocumented: boolean;
  /** Burn degree/depth assessment (negative statements still document it). */
  degreeDocumented?: FactValue<true>;
  /** The dressing and/or debridement actually performed (structured supplies corroborate). */
  treatmentDocumented?: FactValue<true>;
}

// "7% TBSA", "~7 % BSA", "7% of the total body surface area".
const PERCENT_THEN_TBSA_PATTERN =
  /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+)?)?(?:TBSA|BSA|total\s+body\s+surface(?:\s+area)?|body\s+surface(?:\s+area)?)/i;
// "TBSA ~7%", "TBSA: 7%", "estimated BSA of 7%".
const TBSA_THEN_PERCENT_PATTERN =
  /(?:TBSA|BSA|total\s+body\s+surface(?:\s+area)?|body\s+surface(?:\s+area)?)[^.;\n]{0,16}?(\d+(?:\.\d+)?)\s*%/i;
// A bare percentage tied to burn language: "7% partial-thickness burn", "burn covering ~7%".
const PERCENT_THEN_BURN_PATTERN = /(\d+(?:\.\d+)?)\s*%[^.;\n]{0,30}?\bburn/i;
const BURN_THEN_PERCENT_PATTERN = /\bburn\w*[^.;\n]{0,30}?(\d+(?:\.\d+)?)\s*%/i;

// CPT size-class language, used only when no percentage is documented. The small/medium/large
// words must be tied to burn language ("small burn"), never read from stray adjectives.
const CLASS_PHRASE_PATTERNS: Array<[BurnExtentClass, RegExp]> = [
  [
    'large',
    /\blarge\b[^.;\n]{0,24}\bburn|\bburn\w*[^.;\n]{0,24}\blarge\b|more\s+than\s+(?:one|1)\s+extremit\w+|multiple\s+extremit\w+/i,
  ],
  [
    'medium',
    /\bmedium(?:[-\s]sized)?\b[^.;\n]{0,24}\bburn|\bburn\w*[^.;\n]{0,24}\bmedium\b|whole\s+(?:face|extremity|arm|leg)|entire\s+(?:face|extremity|arm|leg)/i,
  ],
  ['small', /\bsmall\b[^.;\n]{0,24}\bburn|\bburn\w*[^.;\n]{0,24}\bsmall\b/i],
];

// Degree/depth is assessment language — "no full-thickness involvement" still documents it.
const DEGREE_PATTERN =
  /(?:first|second|third|1st|2nd|3rd)[-\s]?degree|partial[-\s]?thickness|full[-\s]?thickness|superficial\s+burn/i;

const TREATMENT_PATTERN =
  /\bdress(?:ing|ings|ed)\b|debrid\w*|xeroform|silvadene|silver\s+sulfadiazine|bacitracin|non[-\s]?adherent/i;
const TREATMENT_SUPPLY_PATTERN = /dressing|gauze|xeroform|silvadene|bacitracin|burn\s+kit/i;

function extractTbsaPercent(text: string): { percent: number; index: number; length: number } | undefined {
  for (const pattern of [
    PERCENT_THEN_TBSA_PATTERN,
    TBSA_THEN_PERCENT_PATTERN,
    PERCENT_THEN_BURN_PATTERN,
    BURN_THEN_PERCENT_PATTERN,
  ]) {
    const result = new RegExp(pattern.source, pattern.flags).exec(text);
    if (result !== null) {
      const percent = parseFloat(result[1]);
      if (Number.isFinite(percent) && percent > 0) {
        return { percent, index: result.index, length: result[0].length };
      }
    }
  }
  return undefined;
}

/** Deterministic burn-treatment fact extraction: structured fields first, then details-text patterns. */
export function extractBurnFacts(input: ProcedureFactsInput): BurnFacts {
  const text = input.procedureDetails ?? '';

  let extentClass: FactValue<BurnExtentClass> | undefined;
  let tbsaPercent: number | undefined;
  const percent = extractTbsaPercent(text);
  if (percent !== undefined) {
    tbsaPercent = percent.percent;
    extentClass = {
      value: burnClassForPercent(percent.percent),
      confidence: 'text',
      sourceText: snippetAround(text, percent.index, percent.length),
    };
  } else {
    for (const [cls, pattern] of CLASS_PHRASE_PATTERNS) {
      const found = firstMatch(text, pattern);
      if (found) {
        extentClass = {
          value: cls,
          confidence: 'text',
          sourceText: snippetAround(text, found.index, found.match.length),
        };
        break;
      }
    }
  }

  let treatmentDocumented = textFlag(text, TREATMENT_PATTERN);
  if (!treatmentDocumented && suppliesContain(input, TREATMENT_SUPPLY_PATTERN)) {
    treatmentDocumented = { value: true, confidence: 'structured' };
  }

  return {
    extentClass,
    tbsaPercent,
    locationDocumented:
      Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) || extractSite(input, text) !== undefined,
    degreeDocumented: textMention(text, DEGREE_PATTERN),
    treatmentDocumented,
  };
}

// ── Message building blocks ────────────────────────────────────────────────────

/** How the note pinned the extent, for justifications and mismatch findings. */
function extentPhrase(facts: BurnFacts): string {
  if (facts.tbsaPercent !== undefined) return `${facts.tbsaPercent}% TBSA`;
  const cls = facts.extentClass?.value;
  return cls !== undefined ? `a ${cls} burn` : 'the burn extent';
}

const EXTENT_ASK_CLAUSE =
  'the treated extent selects the code (16020 small, <5% TBSA; 16025 medium, 5–10%; 16030 large, >10%)';

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  extent: { destination: TO_DETAILS, example: '"~7% TBSA partial-thickness burn"' },
  site: { destination: 'in the Site/location field' },
  degree: { destination: TO_DETAILS, example: '"partial-thickness (second-degree)"' },
  treatment: { destination: TO_DETAILS, example: '"cleansed, bacitracin and non-adherent dressing applied"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestBurnTreatmentCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractBurnFacts(input);
  const evaluation = emptyFamilyEvaluation();

  if (facts.extentClass === undefined) {
    evaluation.findings.push({
      level: 'determines',
      message: `The burn's extent is not documented — ${EXTENT_ASK_CLAUSE}. ${whereClause('extent')}`,
    });
    evaluation.openCandidates = [codeCandidate('small'), codeCandidate('medium'), codeCandidate('large')];
    evaluation.openCandidatesSummary = '16020–16030 — the treated burn extent (TBSA %) determines the exact code';
    return evaluation;
  }

  const cls = facts.extentClass.value;
  const info = BURN_CLASS_INFO[cls];
  evaluation.suggestion = {
    code: info.code,
    display: `${info.code} — ${info.display}`,
    justification: `Burn dressing/debridement — ${extentPhrase(facts)} documented (${cls}, ${info.coverage}) → ${
      info.code
    }.`,
  };
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendBurnTreatmentCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractBurnFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const documentedClass = facts.extentClass?.value;

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    const codeClass = CLASS_FOR_CODE[code];
    if (codeClass === undefined) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Extent: the [D] that selects within the family — mismatch is a hard [C] in both directions.
    if (documentedClass === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `The burn's extent is not documented for ${code} — ${EXTENT_ASK_CLAUSE}. ${whereClause('extent')}`,
      });
    } else if (documentedClass !== codeClass) {
      const codeInfo = BURN_CLASS_INFO[codeClass];
      const documentedInfo = BURN_CLASS_INFO[documentedClass];
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} covers a ${codeClass} burn (${codeInfo.coverage}), but the note documents ${extentPhrase(
          facts
        )} (${documentedClass}, ${documentedInfo.coverage}) — as documented this supports ${documentedInfo.code}.`,
        sourceText: facts.extentClass?.sourceText,
        confidence: facts.extentClass?.confidence,
      });
    }

    // [R] elements an auditor expects for any of the three codes.
    if (!facts.locationDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The burn location is not documented for ${code}. ${whereClause('site', 'Select it')}`,
      });
    }
    if (!facts.degreeDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The burn degree is not documented for ${code} — these codes cover partial-thickness burns, so the note should record the depth. ${whereClause(
          'degree'
        )}`,
      });
    }
    if (!facts.treatmentDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The treatment performed is not documented for ${code} — the note should describe the dressing and/or debridement. ${whereClause(
          'treatment'
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

// Matches the product procedure type "Burn Treatment / Dressing" (and its "burn-treatment" slug);
// "Wound Care / Dressing Change" must NOT match, so the pattern keys on "burn", never on "dressing".
const BURN_TREATMENT_TYPE_PATTERN = /\bburns?\b/i;

export const burnTreatmentFamily: ProcedureFamilyModel = {
  id: 'burn-treatment',
  displayName: 'Burn Treatment / Dressing',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = BURN_TREATMENT_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isBurnTreatmentCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractBurnFacts,
  suggestCode: suggestBurnTreatmentCode,
  defendCodes: defendBurnTreatmentCodes,
};
