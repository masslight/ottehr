// Nasal packing (epistaxis control) coding model — functional requirements §11.
// 30901 (anterior, simple) vs 30903 (anterior, complex/extensive) vs 30905 (posterior,
// initial): the bleeding location selects anterior vs posterior outright, and for anterior
// control the documented extensive-packing/cautery elements select complex over simple —
// mirroring the I&D 10060/10061 shape. Other epistaxis codes (e.g. 30906 subsequent
// posterior) are outside scope and are reported "not assessed", never guessed.

import { firstMatch, snippetAround, suppliesContain, textFlag } from '../extract';
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

// ── Locations, complexity, and code table ──────────────────────────────────────

/** The bleeding/packing location the documentation selects (requirements §11). */
export type NasalPackingLocation = 'anterior' | 'posterior';

const NASAL_PACKING_CODE_DISPLAYS: Record<string, string> = {
  '30901': 'Control nasal hemorrhage, anterior, simple (limited cautery and/or packing) any method',
  '30903': 'Control nasal hemorrhage, anterior, complex (extensive cautery and/or packing) any method',
  '30905': 'Control nasal hemorrhage, posterior, with posterior nasal packs and/or cautery, any method; initial',
};

export function isNasalPackingCode(code: string): boolean {
  return NASAL_PACKING_CODE_DISPLAYS[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${NASAL_PACKING_CODE_DISPLAYS[code]}` };
}

/** The complexity elements of §11 — any one documented selects 30903 over 30901 for anterior control. */
export type NasalPackingComplexityElement =
  | 'extensive-packing-or-cautery'
  | 'layered-packing'
  | 'multiple-attempts'
  | 'complex-language';

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface NasalPackingFacts {
  /** Bleeding/packing location. When both are documented, posterior governs (a posterior pack includes the anterior work). */
  location?: FactValue<NasalPackingLocation>;
  /** Complexity elements documented in the text (negation-guarded). */
  complexityElements: FactValue<NasalPackingComplexityElement>[];
  cauteryDocumented?: FactValue<true>;
  /** Packing evidence: packing language or a named product (text or Supplies used). */
  packingDocumented?: FactValue<true>;
  /** Which naris: the structured Side of body field, or left/right naris language in the text. */
  lateralityDocumented: boolean;
  /** Hemostasis achieved (negative statements like "no further bleeding" document it). */
  hemostasisDocumented?: FactValue<true>;
}

const POSTERIOR_PATTERN = /posterior/i;
const ANTERIOR_PATTERN = /anterior/i;

// The multi-word patterns temper their gaps so a clause break is never crossed.
const COMPLEXITY_ELEMENT_PATTERNS: Array<[NasalPackingComplexityElement, RegExp]> = [
  [
    'extensive-packing-or-cautery',
    /extensive(?:ly)?\s+(?:pack\w*|cauter\w*)|(?:pack\w*|cauter\w*)[^.;\n]{0,20}\bextensive/i,
  ],
  ['layered-packing', /layered\s+pack\w*|multiple\s+layers[^.;\n]{0,20}\bpack\w*|pack\w*[^.;\n]{0,20}\bin\s+layers\b/i],
  ['multiple-attempts', /multiple\s+attempts|second\s+attempt|re-?packed|re-?packing|repack\w*/i],
  ['complex-language', /\bcomplex\b/i],
];

const CAUTERY_PATTERN = /cauter\w*|silver\s+nitrate/i;
const PACKING_PATTERN =
  /\bpack(?:ed|ing|s)?\b|merocel|rapid\s*rhino|rhino\s*rocket|nasal\s+tampon|surgicel|(?:vaseline|petrolatum|petroleum)\s+gauze/i;
const PACKING_SUPPLY_PATTERN = /merocel|rapid\s*rhino|rhino\s*rocket|nasal\s+tampon|packing|surgicel/i;

const NARIS_LATERALITY_PATTERN =
  /\b(?:left|right|bilateral)\b[^.;,\n]{0,12}\b(?:naris|nares|nostril)s?\b|\b(?:naris|nares|nostril)s?\b[^.;,\n]{0,12}\b(?:left|right)\b/i;

// Hemostasis is outcome language — the negated forms are themselves the documentation.
const HEMOSTASIS_PATTERN =
  /hemostasis|bleeding\s+(?:controlled|stopped|resolved|ceased)|no\s+(?:further|active|ongoing)\s+bleeding|epistaxis\s+(?:controlled|resolved)/i;

/** Deterministic nasal-packing fact extraction: structured fields first, then details-text patterns. */
export function extractNasalPackingFacts(input: ProcedureFactsInput): NasalPackingFacts {
  const text = input.procedureDetails ?? '';

  // Posterior governs when both appear ("anterior packing failed; posterior pack placed") —
  // the posterior code includes the anterior work.
  let location: FactValue<NasalPackingLocation> | undefined;
  const posterior = firstMatch(text, POSTERIOR_PATTERN);
  const anterior = firstMatch(text, ANTERIOR_PATTERN);
  if (posterior) {
    location = {
      value: 'posterior',
      confidence: 'text',
      sourceText: snippetAround(text, posterior.index, posterior.match.length),
    };
  } else if (anterior) {
    location = {
      value: 'anterior',
      confidence: 'text',
      sourceText: snippetAround(text, anterior.index, anterior.match.length),
    };
  }

  const complexityElements: FactValue<NasalPackingComplexityElement>[] = [];
  for (const [element, pattern] of COMPLEXITY_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      complexityElements.push({
        value: element,
        confidence: 'text',
        sourceText: snippetAround(text, found.index, found.match.length),
      });
    }
  }

  let packingDocumented = textFlag(text, PACKING_PATTERN);
  if (!packingDocumented && suppliesContain(input, PACKING_SUPPLY_PATTERN)) {
    packingDocumented = { value: true, confidence: 'structured' };
  }

  return {
    location,
    complexityElements,
    cauteryDocumented: textFlag(text, CAUTERY_PATTERN),
    packingDocumented,
    lateralityDocumented: Boolean(input.bodySide) || firstMatch(text, NARIS_LATERALITY_PATTERN) !== undefined,
    hemostasisDocumented: textFlag(text, HEMOSTASIS_PATTERN),
  };
}

// ── Message building blocks ────────────────────────────────────────────────────

const COMPLEXITY_ELEMENT_LABELS: Record<NasalPackingComplexityElement, string> = {
  'extensive-packing-or-cautery': 'extensive packing/cautery',
  'layered-packing': 'layered packing',
  'multiple-attempts': 'multiple attempts',
  'complex-language': 'complex control',
};

/** The complexity-element menu, spelled out in plain language for findings. */
const COMPLEXITY_ELEMENT_MENU = 'extensive packing or cautery, layered packing, or multiple attempts';

function complexityElementList(facts: NasalPackingFacts): string {
  return facts.complexityElements.map((element) => COMPLEXITY_ELEMENT_LABELS[element.value]).join(', ');
}

const LOCATION_ASK_CLAUSE = 'the bleeding site selects the code branch (30901/30903 anterior; 30905 posterior)';

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  location: { destination: TO_DETAILS, example: '"anterior epistaxis; anterior packing placed"' },
  complexityElement: { destination: TO_DETAILS, example: '"extensive layered packing after a second attempt"' },
  laterality: { destination: 'in the Side of body field' },
  method: { destination: TO_DETAILS, example: '"silver nitrate cautery, then Merocel packing placed"' },
  hemostasis: { destination: TO_DETAILS, example: '"hemostasis achieved; no further bleeding"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestNasalPackingCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractNasalPackingFacts(input);
  const evaluation = emptyFamilyEvaluation();

  if (facts.location === undefined) {
    evaluation.findings.push({
      level: 'determines',
      message: `The bleeding site is not documented — ${LOCATION_ASK_CLAUSE}. ${whereClause('location')}`,
    });
    evaluation.openCandidates = [codeCandidate('30901'), codeCandidate('30903'), codeCandidate('30905')];
    evaluation.openCandidatesSummary =
      '30901–30905 — the bleeding site (anterior vs posterior) and packing extent determine the code';
    return evaluation;
  }

  if (facts.location.value === 'posterior') {
    evaluation.suggestion = {
      code: '30905',
      display: codeCandidate('30905').display,
      justification: 'Posterior epistaxis control — posterior packing documented → 30905.',
    };
    return evaluation;
  }

  // Anterior branch: the complexity elements select complex over simple.
  if (facts.complexityElements.length > 0) {
    evaluation.suggestion = {
      code: '30903',
      display: codeCandidate('30903').display,
      justification: `Complex anterior epistaxis control — ${complexityElementList(facts)} documented → 30903.`,
    };
  } else {
    evaluation.suggestion = {
      code: '30901',
      display: codeCandidate('30901').display,
      justification: `Simple anterior epistaxis control — none of the complexity elements (${COMPLEXITY_ELEMENT_MENU}) is documented → 30901.`,
    };
  }
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendNasalPackingCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractNasalPackingFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const location = facts.location?.value;
  const firstElement = facts.complexityElements[0];

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    if (!isNasalPackingCode(code)) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Location: the [D] that selects the branch — mismatch is a hard [C] in both directions.
    if (location === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `The bleeding site is not documented for ${code} — ${LOCATION_ASK_CLAUSE}. ${whereClause('location')}`,
      });
    } else if (code === '30905' && location === 'anterior') {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message:
          '30905 covers posterior epistaxis control, but the note documents anterior packing only — as documented this supports 30901/30903 (anterior control).',
        sourceText: facts.location?.sourceText,
        confidence: facts.location?.confidence,
      });
    } else if (code !== '30905' && location === 'posterior') {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} covers anterior epistaxis control, but the note documents posterior packing — as documented this supports 30905 (posterior, initial).`,
        sourceText: facts.location?.sourceText,
        confidence: facts.location?.confidence,
      });
    } else if (code === '30903' && firstElement === undefined) {
      // Branch-matched: complex vs simple, checked both ways (mirrors I&D 10060/10061).
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `30903 is selected, but the note does not document any complexity element (${COMPLEXITY_ELEMENT_MENU}) — as documented this supports 30901 (anterior, simple). ${whereClause(
          'complexityElement',
          'If extensive control was performed, add it'
        )}`,
      });
    } else if (code === '30901' && firstElement !== undefined) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `30901 is selected, but the note documents ${complexityElementList(
          facts
        )} — as documented this supports 30903 (anterior, complex/extensive).`,
        sourceText: firstElement.sourceText,
        confidence: firstElement.confidence,
      });
    }

    // [R] elements an auditor expects for any of the three codes.
    if (!facts.lateralityDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The treated naris is not documented for ${code}. ${whereClause('laterality', 'Select it')}`,
      });
    }
    if (!facts.cauteryDocumented && !facts.packingDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The control method is not documented for ${code} — the note should record the cautery and/or packing used (and the product, e.g. Merocel or Rapid Rhino). ${whereClause(
          'method'
        )}`,
      });
    }
    if (!facts.hemostasisDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Hemostasis is not documented for ${code} — the note should state that the bleeding was controlled. ${whereClause(
          'hemostasis'
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

// Matches the product procedure type "Nasal Packing (Epistaxis Control)" (and its "nasal-packing"
// slug) plus the 30901 CPT descriptor shape ("Control nasal hemorrhage, …"). "Nasal Lavage
// (schnozzle)" and the nasal foreign-body types must never match here.
const NASAL_PACKING_TYPE_PATTERN = /nasal[\s-]*packing|epistaxis|nasal\s+hemorrhage/i;

export const nasalPackingFamily: ProcedureFamilyModel = {
  id: 'nasal-packing',
  displayName: 'Nasal Packing (Epistaxis Control)',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = NASAL_PACKING_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isNasalPackingCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractNasalPackingFacts,
  suggestCode: suggestNasalPackingCode,
  defendCodes: defendNasalPackingCodes,
};
