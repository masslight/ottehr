import {
  firstMatch,
  HEMOSTASIS_PATTERN,
  lateralityDocumented,
  snippetAround,
  suppliesContain,
  textFlag,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFrom,
  defendSelectedCodes,
  joinWithOr,
  SUPPLIES_FIELD_LABEL,
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
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  textEvidence,
  WhereToDocument,
} from '../model.types';

export type NasalPackingLocation = 'anterior' | 'posterior';

const NASAL_PACKING_CODES = {
  anteriorSimple: '30901',
  anteriorComplex: '30903',
  posteriorInitial: '30905',
} as const;

type NasalPackingCode = (typeof NASAL_PACKING_CODES)[keyof typeof NASAL_PACKING_CODES];

const NASAL_PACKING_CODE_DISPLAYS = {
  [NASAL_PACKING_CODES.anteriorSimple]:
    'Control nasal hemorrhage, anterior, simple (limited cautery and/or packing) any method',
  [NASAL_PACKING_CODES.anteriorComplex]:
    'Control nasal hemorrhage, anterior, complex (extensive cautery and/or packing) any method',
  [NASAL_PACKING_CODES.posteriorInitial]:
    'Control nasal hemorrhage, posterior, with posterior nasal packs and/or cautery, any method; initial',
} as const satisfies Record<NasalPackingCode, string>;

export function isNasalPackingCode(code: string): code is NasalPackingCode {
  return code in NASAL_PACKING_CODE_DISPLAYS;
}

const codeCandidate = codeCandidateFrom(NASAL_PACKING_CODE_DISPLAYS);

export type NasalPackingComplexityElement =
  | 'extensive-packing-or-cautery'
  | 'layered-packing'
  | 'multiple-attempts'
  | 'complex-language';

export interface NasalPackingFacts {
  location?: FactValue<NasalPackingLocation>;
  complexityElements: FactValue<NasalPackingComplexityElement>[];
  cauteryDocumented?: FactValue<true>;
  packingDocumented?: FactValue<true>;
  subsequentPackingDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
  hemostasisDocumented?: FactValue<true>;
}

const CONTROL_OR_BLEED_SOURCE = String.raw`pack\w*|balloon\w*|tampon\w*|foley|cauter\w*|bleed\w*|h[ae]morrhag\w*|epistaxis|nose\s*bleeds?`;
const POSTERIOR_EXAM_NOUNS_SOURCE = String.raw`pharyn\w*|oropharyn\w*|nasopharyn\w*|walls?|aspects?|drainage|drip`;

const POSTERIOR_PATTERN = new RegExp(
  [
    String.raw`\bposterior(?:ly)?\s+(?!(?:${POSTERIOR_EXAM_NOUNS_SOURCE})\b)(?:nasal\s+|nasopharyngeal\s+)?(?:${CONTROL_OR_BLEED_SOURCE})`,
    // "packing placed posteriorly", "bleeding from the posterior septum" — the window never crosses a
    // clause break or an exam noun, so a pack in one sentence cannot borrow a "posterior" from the next.
    String.raw`(?:${CONTROL_OR_BLEED_SOURCE})(?:(?!\b(?:${POSTERIOR_EXAM_NOUNS_SOURCE})\b)[^.;\n]){0,24}\bposterior(?:ly)?\b(?!\s+(?:${POSTERIOR_EXAM_NOUNS_SOURCE})\b)`,
  ].join('|'),
  'i'
);
const ANTERIOR_PATTERN = new RegExp(
  [
    String.raw`\banterior(?:ly)?\s+(?:nasal\s+)?(?:${CONTROL_OR_BLEED_SOURCE})`,
    String.raw`(?:${CONTROL_OR_BLEED_SOURCE})[^.;\n]{0,24}\banterior(?:ly)?\b`,
  ].join('|'),
  'i'
);

const PLANNED_MODALITY_SOURCE = String.raw`to|will|would|may|might|should|shall|can|could|plan|plans|planned|planning|consider|recommend|recommended`;
const PERFORMED_REPACKING_SOURCE = String.raw`(?<!\b(?:${PLANNED_MODALITY_SOURCE})\s(?:be\s|been\s|need\s|needs\s|needed\s|to\s)?)(?:re-?pack(?:ed|ing)|repack)\b(?!\s*(?:in\b|if\b|prn\b|as\s+needed|tomorrow|next\b|q\d))`;
const COMPLEXITY_ELEMENT_PATTERNS: Array<[NasalPackingComplexityElement, RegExp]> = [
  [
    'extensive-packing-or-cautery',
    /extensive(?:ly)?\s+(?:pack\w*|cauter\w*)|(?:pack\w*|cauter\w*)[^.;\n]{0,20}\bextensive/i,
  ],
  ['layered-packing', /layered\s+pack\w*|multiple\s+layers[^.;\n]{0,20}\bpack\w*|pack\w*[^.;\n]{0,20}\bin\s+layers\b/i],
  [
    'multiple-attempts',
    new RegExp(
      [String.raw`multiple\s+attempts`, String.raw`second\s+attempt`, PERFORMED_REPACKING_SOURCE].join('|'),
      'i'
    ),
  ],
  [
    'complex-language',
    /complex\s+(?:(?:nasal\s+|anterior\s+|epistaxis\s+)?(?:pack\w*|cauter\w*|control|hemostasis|h[ae]morrhage\s+control))|(?:pack\w*|cauter\w*|control)\s+(?:was\s+|were\s+|is\s+)?complex\b/i,
  ],
];

const CAUTERY_PATTERN = /cauter\w*|silver\s+nitrate/i;

const PACKING_PATTERN =
  /\bpack(?:ed|ing|s)?\b|merocel|rapid\s*rhino|rhino\s*rocket|nasal\s+tampon|surgicel|(?:vaseline|petrolatum|petroleum)\s+gauze/i;
const PACKING_SUPPLY_PATTERN = /merocel|rapid\s*rhino|rhino\s*rocket|nasal\s+tampon|packing|surgicel/i;

const SUBSEQUENT_PACKING_PATTERN =
  /(?:subsequent|repeat|repeated|replacement)\s+(?:posterior\s+)?(?:nasal\s+)?pack\w*|(?:posterior\s+)?pack\w*[^.;\n]{0,16}?\b(?:replaced|changed|exchanged)\b/i;

const NARIS_LATERALITY_PATTERN =
  /\b(?:left|right|bilateral)\b[^.;,\n]{0,12}\b(?:naris|nares|nostril)s?\b|\b(?:naris|nares|nostril)s?\b[^.;,\n]{0,12}\b(?:left|right)\b/i;

export function extractNasalPackingFacts(input: ProcedureFactsInput): NasalPackingFacts {
  const text = input.procedureDetails ?? '';
  let location: FactValue<NasalPackingLocation> | undefined;
  const posterior = firstMatch(text, POSTERIOR_PATTERN);
  const anterior = firstMatch(text, ANTERIOR_PATTERN);
  if (posterior) {
    location = {
      value: 'posterior',
      evidence: textEvidence(snippetAround(text, posterior.index, posterior.match.length)),
    };
  } else if (anterior) {
    location = {
      value: 'anterior',
      evidence: textEvidence(snippetAround(text, anterior.index, anterior.match.length)),
    };
  }

  const complexityElements: FactValue<NasalPackingComplexityElement>[] = [];
  for (const [element, pattern] of COMPLEXITY_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      complexityElements.push({
        value: element,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      });
    }
  }

  let packingDocumented = textFlag(text, PACKING_PATTERN);
  if (!packingDocumented && suppliesContain(input, PACKING_SUPPLY_PATTERN)) {
    packingDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }

  return {
    location,
    complexityElements,
    cauteryDocumented: textFlag(text, CAUTERY_PATTERN),
    packingDocumented,
    subsequentPackingDocumented: textFlag(text, SUBSEQUENT_PACKING_PATTERN),
    lateralityDocumented: lateralityDocumented(input, text, NARIS_LATERALITY_PATTERN),
    hemostasisDocumented: textFlag(text, HEMOSTASIS_PATTERN),
  };
}

const COMPLEXITY_ELEMENT_LABELS: Record<NasalPackingComplexityElement, string> = {
  'extensive-packing-or-cautery': 'extensive packing/cautery',
  'layered-packing': 'layered packing',
  'multiple-attempts': 'multiple attempts',
  'complex-language': 'complex control',
};

const COMPLEXITY_ELEMENT_MENU = joinWithOr(
  COMPLEXITY_ELEMENT_PATTERNS.map(([element]) => COMPLEXITY_ELEMENT_LABELS[element])
);

function complexityElementList(facts: NasalPackingFacts): string {
  return facts.complexityElements.map((element) => COMPLEXITY_ELEMENT_LABELS[element.value]).join(', ');
}

const LOCATION_ASK_CLAUSE = 'the bleeding site selects the code branch (30901/30903 anterior; 30905 posterior)';

const WHERE_TO_DOCUMENT = {
  location: { destination: TO_DETAILS, example: '"anterior epistaxis; anterior packing placed"' },
  complexityElement: { destination: TO_DETAILS, example: '"extensive layered packing after a second attempt"' },
  laterality: { destination: 'in the Side of body field' },
  method: { destination: TO_DETAILS, example: '"silver nitrate cautery, then Merocel packing placed"' },
  subsequent: {
    destination: TO_DETAILS,
    example: '"initial posterior packing this visit" or "posterior pack replaced today"',
  },
  hemostasis: { destination: TO_DETAILS, example: '"hemostasis achieved; no further bleeding"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function methodAskMessage(subject: string): string {
  return `The control performed is not documented${subject} — each code in this family is defined by the cautery and/or packing used (30901 limited, 30903 extensive, 30905 posterior nasal packs), so as documented the note supports none of them. ${whereClause(
    'method'
  )}`;
}

function subsequentPackingMessage(subject: string): string {
  return `${subject} — 30905 covers the initial posterior control, and the note documents a repeat or replacement posterior packing; a subsequent posterior packing is 30906, which is outside this model's scope and is not assessed. ${whereClause(
    'subsequent',
    'If this was the initial posterior packing, say so'
  )}`;
}

function suggestNasalPackingCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractNasalPackingFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  if (facts.location === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The bleeding site is not documented — ${LOCATION_ASK_CLAUSE}. ${whereClause('location')}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      Object.values(NASAL_PACKING_CODES).map(codeCandidate),
      '30901–30905 — the bleeding site (anterior vs posterior) and packing extent determine the code'
    );
    return evaluation;
  }

  if (facts.location.value === 'posterior') {
    if (facts.subsequentPackingDocumented) {
      const message = subsequentPackingMessage('No code is suggested');
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message,
        evidence: citing(facts.subsequentPackingDocumented),
      });
      evaluation.outcome = notAssessedCode(message);
      return evaluation;
    }
    if (!facts.cauteryDocumented && !facts.packingDocumented) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: methodAskMessage(''),
        evidence: NOTHING_TO_CITE,
      });
      evaluation.outcome = openCodeSet(
        [codeCandidate(NASAL_PACKING_CODES.posteriorInitial)],
        '30905 only — posterior control; it applies once the posterior packing and/or cautery performed is documented'
      );
      return evaluation;
    }
    evaluation.outcome = determinedCode({
      code: NASAL_PACKING_CODES.posteriorInitial,
      display: codeCandidate(NASAL_PACKING_CODES.posteriorInitial).display,
      justification: 'Posterior epistaxis control — posterior packing documented → 30905.',
    });
    return evaluation;
  }

  if (!facts.cauteryDocumented && !facts.packingDocumented) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: methodAskMessage(''),
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      [codeCandidate(NASAL_PACKING_CODES.anteriorSimple), codeCandidate(NASAL_PACKING_CODES.anteriorComplex)],
      '30901–30903 — anterior control; the cautery/packing performed and its extent determine which'
    );
    return evaluation;
  }

  if (facts.complexityElements.length > 0) {
    evaluation.outcome = determinedCode({
      code: NASAL_PACKING_CODES.anteriorComplex,
      display: codeCandidate(NASAL_PACKING_CODES.anteriorComplex).display,
      justification: `Complex anterior epistaxis control — ${complexityElementList(facts)} documented → 30903.`,
    });
  } else {
    evaluation.outcome = determinedCode({
      code: NASAL_PACKING_CODES.anteriorSimple,
      display: codeCandidate(NASAL_PACKING_CODES.anteriorSimple).display,
      justification: `Simple anterior epistaxis control — none of the complexity elements (${COMPLEXITY_ELEMENT_MENU}) is documented → 30901.`,
    });
  }
  return evaluation;
}

function defendNasalPackingCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractNasalPackingFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const location = facts.location?.value;
  const firstElement = facts.complexityElements[0];

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isNasalPackingCode(code) ? code : undefined),
    (_info, code, codeFindings) => {
      // Location: the [D] that selects the branch — mismatch is a hard [C] in both directions.
      if (location === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The bleeding site is not documented for ${code} — ${LOCATION_ASK_CLAUSE}. ${whereClause(
            'location'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (
        code === NASAL_PACKING_CODES.posteriorInitial &&
        location === 'posterior' &&
        facts.subsequentPackingDocumented
      ) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: subsequentPackingMessage('30905 is selected'),
          evidence: citing(facts.subsequentPackingDocumented),
        });
      } else if (code === NASAL_PACKING_CODES.posteriorInitial && location === 'anterior') {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message:
            '30905 covers posterior epistaxis control, but the note documents anterior packing only — as documented this supports 30901/30903 (anterior control).',
          evidence: citing(facts.location),
        });
      } else if (code !== NASAL_PACKING_CODES.posteriorInitial && location === 'posterior') {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers anterior epistaxis control, but the note documents posterior packing — as documented this supports 30905 (posterior, initial).`,
          evidence: citing(facts.location),
        });
      } else if (code === NASAL_PACKING_CODES.anteriorComplex && firstElement === undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `30903 is selected, but the note does not document any complexity element (${COMPLEXITY_ELEMENT_MENU}) — as documented this supports 30901 (anterior, simple). ${whereClause(
            'complexityElement',
            ifPerformedClause('performed', 'add it', 'extensive control')
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (code === NASAL_PACKING_CODES.anteriorSimple && firstElement !== undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `30901 is selected, but the note documents ${complexityElementList(
            facts
          )} — as documented this supports 30903 (anterior, complex/extensive).`,
          evidence: citing(firstElement),
        });
      }
      if (!facts.lateralityDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The treated naris is not documented for ${code}. ${whereClause('laterality', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      if (!facts.cauteryDocumented && !facts.packingDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The control method is not documented for ${code} — the note should record the cautery and/or packing used (and the product, e.g. Merocel or Rapid Rhino). ${whereClause(
            'method'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      if (!facts.hemostasisDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Hemostasis is not documented for ${code} — the note should state that the bleeding was controlled. ${whereClause(
            'hemostasis'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  return evaluation;
}

export const nasalPackingFamily: ProcedureFamilyModel = {
  id: 'nasal-packing',
  displayName: 'Nasal Packing (Epistaxis Control)',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('nasal-packing', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isNasalPackingCode(c.code))
  ),
  suggestCode: suggestNasalPackingCode,
  defendCodes: defendNasalPackingCodes,
};
