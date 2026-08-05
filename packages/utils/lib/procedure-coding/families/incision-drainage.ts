// Incision & drainage of abscess coding model — functional requirements §6.2.
// 10060 (simple or single) vs 10061 (complicated or multiple): the complexity elements
// documented in the note are the only within-family determinant — presence of at least one
// justifies 10061, absence means 10060. Other I&D codes (e.g. 10160 puncture aspiration)
// are outside scope and are reported "not assessed", never guessed.

import {
  extractAnesthesiaDocumented,
  extractSite,
  firstMatch,
  INCISION_PATTERN,
  lesionSizeDocumented,
  snippetAround,
  suppliesContain,
  textFlag,
} from '../extract';
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

/** The complexity elements of §6.2 — any one documented selects 10061 over 10060. */
export type IncisionDrainageComplexityElement =
  | 'loculations-dissection'
  | 'probing'
  | 'packing'
  | 'drain-placement'
  | 'multiple-abscesses';

export interface IncisionDrainageFacts {
  /** Abscess location: the structured body-site fields, or a recognized site keyword in the text. */
  locationDocumented: boolean;
  /** Complexity elements documented (text patterns negation-guarded; packing also read from supplies). */
  complexityElements: FactValue<IncisionDrainageComplexityElement>[];
  incisionDocumented?: FactValue<true>;
  /** Drainage character/volume language (purulent, expressed, evacuated, …). */
  drainageDocumented?: FactValue<true>;
  sizeDocumented: boolean;
  anesthesiaDocumented?: FactValue<true>;
  /** The structured Specimen sent field answers this either way; culture language in the text also counts. */
  cultureDocumented: boolean;
  dressingOrToleranceDocumented?: FactValue<true>;
}

// The multi-word patterns temper their gaps with (?!\b(?:no|not|without)\b) so a negation
// inside the phrase ("loculations were not broken up") cannot slip past the pre-match guard.
const COMPLEXITY_ELEMENT_PATTERNS: Array<[IncisionDrainageComplexityElement, RegExp]> = [
  [
    'loculations-dissection',
    /blunt(?:ly)?\s+dissect\w*|loculat\w*(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,40}(?:broken|lysed|disrupted|opened|dissected)|(?:broke|broken|breaking|lys(?:ed|is)|disrupt\w*)(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,40}loculat\w*/i,
  ],
  ['probing', /\bprob(?:e|ed|ing)\b/i],
  ['packing', /\bpack(?:ed|ing)\b|iodoform|\bwick\b/i],
  [
    'drain-placement',
    /\bpenrose\b|\bdrain\b(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,30}\b(?:placed|inserted|left|secured|sutured)\b|\b(?:placed|inserted|left)\b(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,24}\bdrain\b/i,
  ],
  ['multiple-abscesses', /multiple\s+abscess\w*|(?:two|three|second)\s+(?:separate\s+)?abscess\w*|\babscesses\b/i],
];

/** Packing recorded only as a supply (e.g. an iodoform strip in Supplies used). */
const PACKING_SUPPLY_PATTERN = /iodoform|packing|\bwick\b/i;

const DRAINAGE_PATTERN =
  /purulent|\bpus\b|serosanguin\w*|sanguineous|seropurulent|express(?:ed|ion)\b|evacuat\w*|drain(?:ed|age)\b/i;
const CULTURE_PATTERN = /\bculture(?:s|d)?\b|c\s*&\s*s\b|gram\s+stain|wound\s+swab/i;
const DRESSING_TOLERANCE_PATTERN = /dress(?:ing|ed)\b|bandag\w*|band-?aid|gauze[^.;\n]{0,20}applied|tolerat\w*/i;

/** Deterministic I&D fact extraction: structured fields first, then details-text patterns. */
export function extractIncisionDrainageFacts(input: ProcedureFactsInput): IncisionDrainageFacts {
  const text = input.procedureDetails ?? '';

  const complexityElements: FactValue<IncisionDrainageComplexityElement>[] = [];
  for (const [element, pattern] of COMPLEXITY_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      complexityElements.push({
        value: element,
        confidence: 'text',
        sourceText: snippetAround(text, found.index, found.match.length),
      });
    } else if (element === 'packing' && suppliesContain(input, PACKING_SUPPLY_PATTERN)) {
      complexityElements.push({ value: 'packing', confidence: 'structured' });
    }
  }

  return {
    locationDocumented:
      Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) || extractSite(input, text) !== undefined,
    complexityElements,
    incisionDocumented: textFlag(text, INCISION_PATTERN),
    drainageDocumented: textFlag(text, DRAINAGE_PATTERN),
    sizeDocumented: lesionSizeDocumented(input, text),
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    cultureDocumented: input.specimenSent !== undefined || firstMatch(text, CULTURE_PATTERN) !== undefined,
    dressingOrToleranceDocumented: textFlag(text, DRESSING_TOLERANCE_PATTERN),
  };
}

// ── Codes and message building blocks ──────────────────────────────────────────

const INCISION_DRAINAGE_CODE_DISPLAYS: Record<string, string> = {
  '10060': 'Incision and drainage of abscess; simple or single',
  '10061': 'Incision and drainage of abscess; complicated or multiple',
};

export function isIncisionDrainageCode(code: string): boolean {
  return INCISION_DRAINAGE_CODE_DISPLAYS[code] !== undefined;
}

function codeDisplay(code: string): string {
  return `${code} — ${INCISION_DRAINAGE_CODE_DISPLAYS[code]}`;
}

const COMPLEXITY_ELEMENT_LABELS: Record<IncisionDrainageComplexityElement, string> = {
  'loculations-dissection': 'blunt dissection of loculations',
  probing: 'probing of the abscess cavity',
  packing: 'packing placed',
  'drain-placement': 'drain placement',
  'multiple-abscesses': 'multiple abscesses',
};

/** The complexity-element menu, spelled out in plain language for findings. */
const COMPLEXITY_ELEMENT_MENU =
  'blunt dissection of loculations, probing of the cavity, packing, drain placement, or multiple abscesses';

function complexityElementList(facts: IncisionDrainageFacts): string {
  return facts.complexityElements.map((element) => COMPLEXITY_ELEMENT_LABELS[element.value]).join(', ');
}

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  incision: { destination: TO_DETAILS, example: '"#11 blade stab incision at the point of maximal fluctuance"' },
  drainage: { destination: TO_DETAILS, example: '"~5 mL purulent drainage expressed"' },
  complexityElement: {
    destination: TO_DETAILS,
    example: '"loculations broken up by blunt dissection; iodoform packing placed"',
  },
  size: { destination: 'in the Wound/lesion size (cm) field' },
  anesthesia: {
    destination: 'in the Anaesthesia / medication used field',
    example: '"2 mL 1% lidocaine with epinephrine"',
  },
  culture: { destination: 'in the Specimen sent field' },
  dressing: { destination: TO_DETAILS, example: '"dry dressing applied; procedure tolerated well"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestIncisionDrainageCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractIncisionDrainageFacts(input);
  const evaluation = emptyFamilyEvaluation();

  // The complexity elements are the only determinant: presence ⇒ 10061, absence ⇒ 10060.
  if (facts.complexityElements.length > 0) {
    evaluation.suggestion = {
      code: '10061',
      display: codeDisplay('10061'),
      justification: `Complicated or multiple I&D — ${complexityElementList(facts)} documented → 10061.`,
    };
  } else {
    evaluation.suggestion = {
      code: '10060',
      display: codeDisplay('10060'),
      justification: `Simple I&D — none of the complexity elements (${COMPLEXITY_ELEMENT_MENU}) is documented → 10060.`,
    };
  }
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendIncisionDrainageCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractIncisionDrainageFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const firstElement = facts.complexityElements[0];
  let anyInScope = false;

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    if (!isIncisionDrainageCode(code)) {
      notAssessedCodes.push(code);
      continue;
    }
    anyInScope = true;
    const codeFindings: Finding[] = [];

    // Complexity elements: the [D] that selects within the family, checked both ways.
    if (code === '10061' && firstElement === undefined) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `10061 is selected, but the note does not document any complexity element (${COMPLEXITY_ELEMENT_MENU}) — as documented this supports 10060 (simple or single abscess). ${whereClause(
          'complexityElement',
          'If one was performed, add it'
        )}`,
      });
    }
    if (code === '10060' && firstElement !== undefined) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `10060 is selected, but the note documents ${complexityElementList(
          facts
        )} — as documented this supports 10061 (complicated or multiple).`,
        sourceText: firstElement.sourceText,
        confidence: firstElement.confidence,
      });
    }

    // [R] elements an auditor expects for either code.
    if (!facts.locationDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The abscess location is not documented for ${code}. ${whereClause('site', 'Select it')}`,
      });
    }
    if (!facts.incisionDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The incision is not documented for ${code} — the note should describe how the abscess was opened. ${whereClause(
          'incision'
        )}`,
      });
    }
    if (!facts.drainageDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Drainage is not documented for ${code} — the note should record the character (and ideally volume) of what drained. ${whereClause(
          'drainage'
        )}`,
      });
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(code);
    }
    findings.push(...codeFindings);
  }

  if (anyInScope) {
    // Entry-level best practices, emitted once per entry.
    if (!facts.sizeDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Lesion size is not documented — it does not select the code, but it supports the complexity narrative. ${whereClause(
          'size',
          'Enter it'
        )}`,
      });
    }
    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Anesthesia is not noted — it does not affect the code (local anesthesia is included), but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
      });
    }
    if (!facts.cultureDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Culture & sensitivity is not documented — record whether a specimen was sent. ${whereClause(
          'culture',
          'Record it'
        )}`,
      });
    }
    if (!facts.dressingOrToleranceDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Dressing and patient tolerance are not documented. ${whereClause('dressing', 'Add them')}`,
      });
    }
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

// Matches the product procedure type "Incision and Drainage (I&D) of Abscess" and freehand variants.
const INCISION_DRAINAGE_TYPE_PATTERN = /incision\s*(?:and|&|\+)?\s*drainage|\bI\s*&\s*D\b|abscess/i;

export const incisionDrainageFamily: ProcedureFamilyModel = {
  id: 'incision-drainage',
  displayName: 'Incision & Drainage of Abscess',
  usesStructuredLength: true,
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = INCISION_DRAINAGE_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isIncisionDrainageCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractIncisionDrainageFacts,
  suggestCode: suggestIncisionDrainageCode,
  defendCodes: defendIncisionDrainageCodes,
};
