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
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFrom,
  defendSelectedCodes,
  joinWithOr,
  SITE_FIELD_LABEL,
  SUPPLIES_FIELD_LABEL,
  TECHNIQUE_FIELD_LABEL,
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
  ProcedureStructuredField,
  textEvidence,
  WhereToDocument,
} from '../model.types';

export type IncisionDrainageComplexityElement =
  | 'loculations-dissection'
  | 'probing'
  | 'packing'
  | 'drain-placement'
  | 'multiple-abscesses';

export type IncisionDrainageOutOfScopeSite = 'pilonidal' | 'perianal' | 'external-ear' | 'finger' | 'hematoma-seroma';

export interface IncisionDrainageFacts {
  locationDocumented: boolean;
  outOfScopeSite?: FactValue<IncisionDrainageOutOfScopeSite>;
  complexityElements: FactValue<IncisionDrainageComplexityElement>[];
  incisionDocumented?: FactValue<true>;
  drainageDocumented?: FactValue<true>;
  sizeDocumented: boolean;
  anesthesiaDocumented?: FactValue<true>;
  cultureDocumented: boolean;
  dressingOrToleranceDocumented?: FactValue<true>;
}

const ABSCESS_HISTORY_SOURCE = String.raw`\bhistor\w*|\bh\/o\b|\bhx\b|\brecurrent\b|\brecurring\b|\bchronic\b|\bprior\b|\bprevious\b|\bpast\b|\bknown\b|\brepeated\b`;
const ABSCESS_PLURAL_SOURCE = String.raw`(?<!(?:${ABSCESS_HISTORY_SOURCE})[^.;\n]{0,20})(?:(?:multiple|two|three|four|five|several|second)\s+(?:separate\s+|distinct\s+|additional\s+)?abscess(?:es)?\b|\babscesses\b)`;
const DRAINED_HERE_SOURCE = String.raw`incis\w*|drain\w*|lanc(?:e|ed|ing)\b|evacuat\w*|\bI\s*&\s*D\b`;

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
  [
    'multiple-abscesses',
    new RegExp(
      [
        String.raw`(?:${ABSCESS_PLURAL_SOURCE})[^.;\n]{0,40}?\b(?:${DRAINED_HERE_SOURCE})`,
        String.raw`\b(?:${DRAINED_HERE_SOURCE})[^.;\n]{0,40}?(?:${ABSCESS_PLURAL_SOURCE})`,
      ].join('|'),
      'i'
    ),
  ],
];

/** What applies instead, per out-of-scope site — named in the message so the provider can act on it. */
const OUT_OF_SCOPE_SITE_CODING: Record<IncisionDrainageOutOfScopeSite, { label: string; codes: string }> = {
  pilonidal: {
    label: 'a pilonidal cyst or abscess',
    codes: '10080/10081 (incision and drainage of pilonidal cyst, simple or complicated)',
  },
  perianal: {
    label: 'a perianal, perirectal, or ischiorectal abscess',
    codes: '46050 (perianal, superficial) or 46060 (ischiorectal or intramural)',
  },
  'external-ear': {
    label: 'an external-ear abscess or hematoma',
    codes: '69000/69005 (drainage of external ear abscess or hematoma, simple or complicated)',
  },
  finger: {
    label: 'a finger abscess (a felon or paronychia is coded here too)',
    codes: '26010/26011 (drainage of finger abscess, simple or complicated)',
  },
  'hematoma-seroma': {
    label: 'a hematoma, seroma, or other fluid collection rather than an abscess',
    codes: '10140 (incision and drainage of hematoma, seroma, or fluid collection)',
  },
};

// Order matters: the lesion type wins over the region (a pilonidal abscess is 10080/10081 wherever
// it sits), and the hematoma/seroma keywords come last so a more specific site match is never
// pre-empted by an incidental fluid-collection mention.
const OUT_OF_SCOPE_SITE_PATTERNS: Array<[IncisionDrainageOutOfScopeSite, RegExp]> = [
  ['pilonidal', /pilonidal/i],
  ['perianal', /peri-?anal|peri-?rectal|ischio-?rectal|intersphincteric/i],
  ['external-ear', /external\s+ear|auricl\w*|\bpinna\b|ear-?lobe|perichondr\w*/i],
  ['finger', /\bfingers?\b|\bfingertip\b|\bthumb\b|\bfelon\b|paronychia/i],
  ['hematoma-seroma', /h[ae]matoma|seroma|fluid\s+collection/i],
];

/** A documented site/lesion type coded outside this family: structured body site first, then the text. */
function extractOutOfScopeSite(
  input: ProcedureFactsInput,
  text: string
): FactValue<IncisionDrainageOutOfScopeSite> | undefined {
  const structured = [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
  if (structured.trim().length > 0) {
    for (const [site, pattern] of OUT_OF_SCOPE_SITE_PATTERNS) {
      if (pattern.test(structured)) return { value: site, evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }
  }
  for (const [site, pattern] of OUT_OF_SCOPE_SITE_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      return { value: site, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    }
  }
  return undefined;
}

/**
 * Complexity elements the Supplies used field establishes on its own. Packing and a drain are both
 * stocked supplies, and picking one is a positive statement that it was part of the procedure — the
 * item is on the form precisely because the provider used it, so the narrative does not have to
 * repeat it. The other three elements have no supply that could stand for them.
 */
const COMPLEXITY_ELEMENT_SUPPLY_PATTERNS: Partial<Record<IncisionDrainageComplexityElement, RegExp>> = {
  packing: /iodoform|packing|\bwick\b/i,
  'drain-placement': /\bdrains?\b|\bpenrose\b/i,
};

const DRAINAGE_PATTERN =
  /purulent|\bpus\b|serosanguin\w*|sanguineous|seropurulent|express(?:ed|ion)\b|evacuat\w*|drain(?:ed|age)\b/i;
const CULTURE_PATTERN = /\bculture(?:s|d)?\b|c\s*&\s*s\b|gram\s+stain|wound\s+swab/i;
const DRESSING_TOLERANCE_PATTERN = /dress(?:ing|ed)\b|bandag\w*|band-?aid|gauze[^.;\n]{0,20}applied|tolerat\w*/i;

export function extractIncisionDrainageFacts(input: ProcedureFactsInput): IncisionDrainageFacts {
  const text = input.procedureDetails ?? '';

  const complexityElements: FactValue<IncisionDrainageComplexityElement>[] = [];
  for (const [element, pattern] of COMPLEXITY_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);

    if (found) {
      complexityElements.push({
        value: element,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      });
      continue;
    }

    if ((input.technique ?? []).some((value) => pattern.test(value))) {
      complexityElements.push({ value: element, evidence: fieldEvidence(TECHNIQUE_FIELD_LABEL) });
      continue;
    }

    const supplyPattern = COMPLEXITY_ELEMENT_SUPPLY_PATTERNS[element];

    if (supplyPattern !== undefined && suppliesContain(input, supplyPattern)) {
      complexityElements.push({ value: element, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) });
    }
  }

  return {
    locationDocumented:
      Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) || extractSite(input, text) !== undefined,
    outOfScopeSite: extractOutOfScopeSite(input, text),
    complexityElements,
    incisionDocumented: textFlag(text, INCISION_PATTERN),
    drainageDocumented: textFlag(text, DRAINAGE_PATTERN),
    sizeDocumented: lesionSizeDocumented(input, text),
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    cultureDocumented: input.specimenSent !== undefined || firstMatch(text, CULTURE_PATTERN) !== undefined,
    dressingOrToleranceDocumented: textFlag(text, DRESSING_TOLERANCE_PATTERN),
  };
}

const INCISION_DRAINAGE_CODES = {
  simpleOrSingle: '10060',
  complicatedOrMultiple: '10061',
} as const;

type IncisionDrainageCode = (typeof INCISION_DRAINAGE_CODES)[keyof typeof INCISION_DRAINAGE_CODES];

const INCISION_DRAINAGE_CODE_DISPLAYS = {
  [INCISION_DRAINAGE_CODES.simpleOrSingle]: 'Incision and drainage of abscess; simple or single',
  [INCISION_DRAINAGE_CODES.complicatedOrMultiple]: 'Incision and drainage of abscess; complicated or multiple',
} as const satisfies Record<IncisionDrainageCode, string>;

export function isIncisionDrainageCode(code: string): code is IncisionDrainageCode {
  return code in INCISION_DRAINAGE_CODE_DISPLAYS;
}

function codeDisplay(code: IncisionDrainageCode): string {
  return `${code} — ${INCISION_DRAINAGE_CODE_DISPLAYS[code]}`;
}

const codeCandidate = codeCandidateFrom(INCISION_DRAINAGE_CODE_DISPLAYS);

const COMPLEXITY_ELEMENT_LABELS: Record<IncisionDrainageComplexityElement, string> = {
  'loculations-dissection': 'blunt dissection of loculations',
  probing: 'probing of the abscess cavity',
  packing: 'packing placed',
  'drain-placement': 'drain placement',
  'multiple-abscesses': 'multiple abscesses',
};

const COMPLEXITY_ELEMENT_MENU = joinWithOr(
  COMPLEXITY_ELEMENT_PATTERNS.map(([element]) => COMPLEXITY_ELEMENT_LABELS[element])
);

function complexityElementMenuExcept(exclude: IncisionDrainageComplexityElement): string {
  return joinWithOr(
    COMPLEXITY_ELEMENT_PATTERNS.filter(([element]) => element !== exclude).map(
      ([element]) => COMPLEXITY_ELEMENT_LABELS[element]
    )
  );
}

function complexityElementList(facts: IncisionDrainageFacts): string {
  return facts.complexityElements.map((element) => COMPLEXITY_ELEMENT_LABELS[element.value]).join(', ');
}

const OPEN_CANDIDATES_SUMMARY =
  '10060–10061 — the incision and drainage performed, and whether any complexity element is documented, determine which';

const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  procedure: {
    destination: TO_DETAILS,
    example: '"#11 blade stab incision at the point of maximal fluctuance; ~5 mL purulent drainage expressed"',
  },
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

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function outOfScopeSiteMessage(site: IncisionDrainageOutOfScopeSite, subject: string): string {
  const { label, codes } = OUT_OF_SCOPE_SITE_CODING[site];
  return `${subject} — the note documents ${label}, and 10060/10061 cover incision and drainage of a cutaneous abscess. That drainage is ${codes}, which is outside this model's scope and is not assessed.`;
}

function procedureAskMessage(facts: IncisionDrainageFacts): string {
  const missing = [
    facts.incisionDocumented === undefined ? 'the incision' : undefined,
    facts.drainageDocumented === undefined ? 'the drainage' : undefined,
  ].filter((part): part is string => part !== undefined);
  return `The procedure itself is not documented (${missing.join(
    ' and '
  )} missing) — 10060 and 10061 are both defined as incision and drainage of an abscess, so as documented the note supports neither, and with the procedure absent the absence of complexity language says nothing about complexity. ${whereClause(
    'procedure'
  )}`;
}

function suggestIncisionDrainageCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractIncisionDrainageFacts(input);
  const evaluation = emptySuggestionEvaluation();

  if (facts.outOfScopeSite) {
    const message = outOfScopeSiteMessage(facts.outOfScopeSite.value, 'No code is suggested');
    evaluation.findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message,
      evidence: citing(facts.outOfScopeSite),
    });
    evaluation.outcome = notAssessedCode(message);
    return evaluation;
  }

  if (!facts.incisionDocumented || !facts.drainageDocumented) {
    evaluation.findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: procedureAskMessage(facts),
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      [
        codeCandidate(INCISION_DRAINAGE_CODES.simpleOrSingle),
        codeCandidate(INCISION_DRAINAGE_CODES.complicatedOrMultiple),
      ],
      OPEN_CANDIDATES_SUMMARY
    );
    return evaluation;
  }

  if (facts.complexityElements.length > 0) {
    evaluation.outcome = determinedCode({
      code: INCISION_DRAINAGE_CODES.complicatedOrMultiple,
      display: codeDisplay(INCISION_DRAINAGE_CODES.complicatedOrMultiple),
      justification: `Complicated or multiple I&D — ${complexityElementList(facts)} documented → 10061.`,
    });
  } else {
    evaluation.outcome = determinedCode({
      code: INCISION_DRAINAGE_CODES.simpleOrSingle,
      display: codeDisplay(INCISION_DRAINAGE_CODES.simpleOrSingle),
      justification: `Simple I&D — none of the complexity elements (${COMPLEXITY_ELEMENT_MENU}) is documented → 10060.`,
    });
  }
  return evaluation;
}

function defendIncisionDrainageCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractIncisionDrainageFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const firstElement = facts.complexityElements[0];
  const anyInScope = selected.some((c) => isIncisionDrainageCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isIncisionDrainageCode(code) ? code : undefined),
    (_info, code, codeFindings, answerAtEntryLevel) => {
      if (facts.outOfScopeSite) {
        findings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: outOfScopeSiteMessage(facts.outOfScopeSite.value, `${code} is selected`),
          evidence: citing(facts.outOfScopeSite),
        });
        answerAtEntryLevel();
        return;
      }

      if (code === INCISION_DRAINAGE_CODES.complicatedOrMultiple && firstElement === undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `10061 is selected, but the note does not document any complexity element (${COMPLEXITY_ELEMENT_MENU}) — as documented this supports 10060 (simple or single abscess). ${whereClause(
            'complexityElement',
            ifPerformedClause('performed', 'add it')
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      const packingOnly = facts.complexityElements.length === 1 && facts.complexityElements[0].value === 'packing';

      if (code === INCISION_DRAINAGE_CODES.simpleOrSingle && firstElement !== undefined) {
        codeFindings.push({
          level: packingOnly ? 'bestPractice' : 'contradiction',
          scope: codeScope(code),
          message: packingOnly
            ? `10060 is selected and the note documents ${
                COMPLEXITY_ELEMENT_LABELS.packing
              } — packing supports a complicated I&D rather than establishing one on its own, so 10060 stands as documented. ${whereClause(
                'complexityElement',
                `If ${complexityElementMenuExcept('packing')} was also part of the procedure, add it`
              )}`
            : `10060 is selected, but the note documents ${complexityElementList(
                facts
              )} — as documented this supports 10061 (complicated or multiple).`,
          evidence: citing(firstElement),
        });
      }

      if (!facts.locationDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The abscess location is not documented for ${code}. ${whereClause('site', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.incisionDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The incision is not documented for ${code} — the note should describe how the abscess was opened. ${whereClause(
            'incision'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.drainageDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Drainage is not documented for ${code} — the note should record the character (and ideally volume) of what drained. ${whereClause(
            'drainage'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (anyInScope) {
    if (!facts.sizeDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Lesion size is not documented — it does not select the code, but it supports the complexity narrative. ${whereClause(
          'size',
          'Enter it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Anesthesia is not noted — it does not affect the code (local anesthesia is included), but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.cultureDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Culture & sensitivity is not documented — record whether a specimen was sent. ${whereClause(
          'culture',
          'Record it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.dressingOrToleranceDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Dressing and patient tolerance are not documented. ${whereClause('dressing', 'Add them')}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}

export const incisionDrainageFamily: ProcedureFamilyModel = {
  id: 'incision-drainage',
  displayName: 'Incision & Drainage of Abscess',
  structuredFieldsFor: () => [ProcedureStructuredField.Length],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('incision-drainage', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isIncisionDrainageCode(c.code))
  ),
  suggestCode: suggestIncisionDrainageCode,
  defendCodes: defendIncisionDrainageCodes,
};
