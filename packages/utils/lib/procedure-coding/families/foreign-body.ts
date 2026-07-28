import {
  AnatomicSite,
  extractAnesthesiaDocumented,
  extractSite,
  firstMatch,
  HEMOSTASIS_PATTERN,
  INCISION_PATTERN,
  lateralityDocumented,
  lesionSizeDocumented,
  normalizeAnatomicSite,
  snippetAround,
  textFlag,
  textMention,
  TM_INTACT_PATTERN,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFromInfo,
  defendSelectedCodes,
  joinWithOr,
  lateralityFinding,
  MEDICATION_FIELD_LABEL,
  SITE_FIELD_LABEL,
  TECHNIQUE_FIELD_LABEL,
  TO_DETAILS,
  whereClauseFor,
} from '../family-support';
import {
  citing,
  CodeCandidate,
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

export type ForeignBodySite = 'skin' | 'nose' | 'eye' | 'ear';

export type EyeStructure = 'cornea' | 'conjunctiva' | 'eyelid';

interface ForeignBodyCodeInfo {
  site: ForeignBodySite;
  display: string;
  coverage: string;
}

const FOREIGN_BODY_CODES = {
  skinSimple: '10120',
  skinComplicated: '10121',
  intranasalOffice: '30300',
  cornealWithoutSlitLamp: '65220',
  cornealWithSlitLamp: '65222',
  earCanalWithoutGeneralAnesthesia: '69200',
} as const;

const FOREIGN_BODY_OUT_OF_SCOPE_CODES = {
  intranasalUnderGeneralAnesthesia: '30310',
  earCanalUnderGeneralAnesthesia: '69205',
} as const;

type ForeignBodyCode = (typeof FOREIGN_BODY_CODES)[keyof typeof FOREIGN_BODY_CODES];

const FOREIGN_BODY_CODE_INFO = {
  [FOREIGN_BODY_CODES.skinSimple]: {
    site: 'skin',
    display: 'Incision and removal of foreign body, subcutaneous tissues; simple',
    coverage: 'removal of a foreign body from the skin/subcutaneous tissues by incision',
  },
  [FOREIGN_BODY_CODES.skinComplicated]: {
    site: 'skin',
    display: 'Incision and removal of foreign body, subcutaneous tissues; complicated',
    coverage: 'removal of a foreign body from the skin/subcutaneous tissues by incision',
  },
  [FOREIGN_BODY_CODES.intranasalOffice]: {
    site: 'nose',
    display: 'Removal foreign body, intranasal; office type procedure',
    coverage: 'removal of an intranasal foreign body',
  },
  [FOREIGN_BODY_CODES.cornealWithoutSlitLamp]: {
    site: 'eye',
    display: 'Removal of foreign body, external eye; corneal, without slit lamp',
    coverage: 'removal of a corneal foreign body without a slit lamp',
  },
  [FOREIGN_BODY_CODES.cornealWithSlitLamp]: {
    site: 'eye',
    display: 'Removal of foreign body, external eye; corneal, with slit lamp',
    coverage: 'removal of a corneal foreign body',
  },
  [FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia]: {
    site: 'ear',
    display: 'Removal foreign body from external auditory canal; without general anesthesia',
    coverage: 'removal of a foreign body from the external ear canal',
  },
} as const satisfies Record<ForeignBodyCode, ForeignBodyCodeInfo>;

export function isForeignBodyRemovalCode(code: string): code is ForeignBodyCode {
  return code in FOREIGN_BODY_CODE_INFO;
}

const codeCandidate = codeCandidateFromInfo(FOREIGN_BODY_CODE_INFO);

const NO_PROCEDURE_CODE_CANDIDATE: CodeCandidate = {
  code: 'none',
  display: 'No separate procedure code — a removal without an incision is part of the visit (E/M) charge',
};

const SITE_BRANCH_LABELS: Record<ForeignBodySite, string> = {
  skin: 'skin/soft tissue',
  nose: 'nose',
  eye: 'eye',
  ear: 'ear canal',
};

export type ForeignBodyComplicationElement =
  | 'deep-dissection'
  | 'multiple-foreign-bodies'
  | 'imaging-localization'
  | 'stated-complicated';

export interface ForeignBodyFacts {
  site?: FactValue<ForeignBodySite>;
  eyeStructure?: FactValue<EyeStructure>;
  incisionDocumented?: FactValue<true>;
  complicationElements: FactValue<ForeignBodyComplicationElement>[];
  slitLampDocumented?: FactValue<true>;
  withoutSlitLampDocumented?: FactValue<true>;
  descriptionDocumented?: FactValue<true>;
  outcomeDocumented?: FactValue<true>;
  postAssessmentDocumented?: FactValue<true>;
  anesthesiaDocumented?: FactValue<true>;
  generalAnesthesiaDocumented?: FactValue<true>;
  sizeDocumented: boolean;
  lateralityRequired: boolean;
  lateralityDocumented: boolean;
}

const BRANCH_PATTERNS: Array<[ForeignBodySite, RegExp]> = [
  ['eye', /\beyes?\b|cornea\w*|conjunctiv\w*|ocular|eyelid/i],
  ['nose', /\bnose\b|nasal|nostril|nares?\b|intranasal/i],
  ['ear', /\bears?\b|ear\s+canal|auditory\s+canal|auricle|pinna/i],
  ['skin', /\bskin\b|soft\s+tissue|subcutaneous|\bsub-?q\b/i],
];

const EYE_STRUCTURE_PATTERNS: Array<[EyeStructure, RegExp]> = [
  ['cornea', /cornea\w*/i],
  ['conjunctiva', /conjunctiv\w*|subtarsal|palpebral\s+fornix/i],
  ['eyelid', /eyelids?|\b(?:upper|lower)\s+lid\b|tarsal\s+plate/i],
];

const CORNEAL_WITHOUT_SLIT_LAMP_PATTERN = /cornea\w*[^.;\n]{0,80}\b(?:without|no)\s+(?:a\s+)?slit[-\s]?lamp\b/i;

function branchForAnatomicSite(site: string): ForeignBodySite {
  return site === 'ear' ? 'ear' : site === 'nose' ? 'nose' : site === 'eyelid' ? 'eye' : 'skin';
}

function structuredSiteText(input: ProcedureFactsInput): string {
  return [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
}

function extractForeignBodySite(input: ProcedureFactsInput, text: string): FactValue<ForeignBodySite> | undefined {
  const structured = structuredSiteText(input);
  if (structured.trim().length > 0) {
    for (const [site, pattern] of BRANCH_PATTERNS) {
      if (pattern.test(structured)) return { value: site, evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }

    const normalized = normalizeAnatomicSite(structured);

    if (normalized !== undefined)
      return { value: branchForAnatomicSite(normalized), evidence: fieldEvidence(SITE_FIELD_LABEL) };
  }

  for (const [site, pattern] of BRANCH_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      return { value: site, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    }
  }

  const textSite = extractSite(input, text);

  if (textSite !== undefined) {
    return { value: branchForAnatomicSite(textSite.value), evidence: textSite.evidence };
  }

  return undefined;
}

function extractEyeStructure(input: ProcedureFactsInput, text: string): FactValue<EyeStructure> | undefined {
  const structured = structuredSiteText(input);

  if (structured.trim().length > 0) {
    for (const [structure, pattern] of EYE_STRUCTURE_PATTERNS) {
      if (pattern.test(structured)) return { value: structure, evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }
  }

  const cornealWithoutSlitLamp = textMention(text, CORNEAL_WITHOUT_SLIT_LAMP_PATTERN);

  if (cornealWithoutSlitLamp !== undefined) {
    return { value: 'cornea', evidence: cornealWithoutSlitLamp.evidence };
  }

  for (const [structure, pattern] of EYE_STRUCTURE_PATTERNS) {
    const found = firstMatch(text, pattern);

    if (found) {
      return { value: structure, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    }
  }

  return undefined;
}

const DEEP_DISSECTION_PATTERN =
  /deep(?:er)?\s+dissect\w*|dissect(?:ed|ion)\s+(?:deep|down)|dissect\w*[^.;\n]{0,30}\b(?:fascia|muscle|deep)|extensive\s+dissect\w*/i;

const MULTIPLE_FOREIGN_BODIES_PATTERN =
  /(?:multiple|several|numerous)\s+(?:\w+\s+){0,2}?(?:foreign\s+bodies|splinters|thorns|pellets|beads|shards|slivers|stingers)\b|\b(?:two|three|four|five|\d{1,2})\s+(?:separate|distinct|additional)\s+foreign\s+bod(?:y|ies)\b/i;

const IMAGING_LOCALIZATION_PATTERN =
  /(?:ultrasound|sonograph\w*|x-?ray|radiograph\w*|fluoroscop\w*)[^.;\n]{0,40}?(?:guid\w*|localiz\w*|assist\w*)|(?:guid\w*|localiz\w*|assist\w*)[^.;\n]{0,20}?(?:ultrasound|sonograph\w*|x-?ray|radiograph\w*|fluoroscop\w*)/i;

const STATED_COMPLICATED_PATTERN = /complicated\s+(?:removal|extraction|foreign[-\s]body)/i;

const COMPLICATION_ELEMENT_PATTERNS: Array<[ForeignBodyComplicationElement, RegExp]> = [
  ['deep-dissection', DEEP_DISSECTION_PATTERN],
  ['multiple-foreign-bodies', MULTIPLE_FOREIGN_BODIES_PATTERN],
  ['imaging-localization', IMAGING_LOCALIZATION_PATTERN],
  ['stated-complicated', STATED_COMPLICATED_PATTERN],
];

const COMPLICATION_ELEMENT_LABELS: Record<ForeignBodyComplicationElement, string> = {
  'deep-dissection': 'deep dissection',
  'multiple-foreign-bodies': 'multiple foreign bodies',
  'imaging-localization': 'imaging-assisted localization',
  'stated-complicated': 'an explicitly complicated removal',
};

const COMPLICATION_ELEMENT_MENU = joinWithOr(
  COMPLICATION_ELEMENT_PATTERNS.map(([element]) => COMPLICATION_ELEMENT_LABELS[element])
);

function extractComplicationElements(text: string): FactValue<ForeignBodyComplicationElement>[] {
  const elements: FactValue<ForeignBodyComplicationElement>[] = [];
  for (const [element, pattern] of COMPLICATION_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      elements.push({
        value: element,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      });
    }
  }
  return elements;
}

const SLIT_LAMP_PATTERN = /slit[-\s]?lamp|biomicroscop\w*/i;
const WITHOUT_SLIT_LAMP_PATTERN = /\b(?:without|no)\s+(?:a\s+)?slit[-\s]?lamp\b/i;

const FOREIGN_BODY_DESCRIPTION_PATTERN =
  /splinter|\bglass\b|metal(?:lic)?\b|wood(?:en)?\b|\bthorn\b|\bbead\b|\bBB\b|pellet|pebble|gravel|fish\s*-?\s*hook|\bneedle\b|\bpin\b|\btack\b|insect|\bbug\b|\btick\b|\bbee\b|stinger|\bbean\b|\bseed\b|popcorn|plastic|eraser|\btoy\b|button|batter(?:y|ies)|crayon|\bsand\b|\bdirt\b|cotton|\brock\b|\bstone\b|\bfood\b/i;

const OUTCOME_PATTERN =
  /(?:removed|retrieved|extracted|expelled)\s+(?:completely|intact|in\s+(?:its\s+)?entirety|in\s+total|whole)|complete(?:ly)?\s+(?:removed|removal|extracted|retrieved)|removal\s+(?:was\s+)?complete|(?:no|without)\s+(?:residual|retained)\s+(?:foreign\s+body|fragments?|material)/i;

const FLUORESCEIN_PATTERN = /fluorescein|seidel|wood'?s\s+lamp/i;

const GENERAL_ANESTHESIA_PATTERN =
  /general\s+anesthe\w*|\bGETA\b|endotracheal\s+(?:tube|intubation|anesthe\w*)|(?:procedural|moderate|conscious|deep|IV|intravenous)\s+sedation|under\s+sedation|\bsedated\b|\bketamine\b|\bpropofol\b|\betomidate\b/i;

const POST_ASSESSMENT_PATTERNS: Record<ForeignBodySite, RegExp> = {
  skin: HEMOSTASIS_PATTERN,
  nose: HEMOSTASIS_PATTERN,
  eye: FLUORESCEIN_PATTERN,
  ear: TM_INTACT_PATTERN,
};

const LATERALIZABLE_SKIN_SITES: AnatomicSite[] = ['axilla', 'extremity', 'hand', 'foot'];

function extractGeneralAnesthesiaDocumented(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  const fromText = textFlag(text, GENERAL_ANESTHESIA_PATTERN);
  if (fromText) return fromText;
  if (input.medicationUsed && GENERAL_ANESTHESIA_PATTERN.test(input.medicationUsed)) {
    return { value: true, evidence: fieldEvidence(MEDICATION_FIELD_LABEL) };
  }
  return undefined;
}

export function extractForeignBodyFacts(input: ProcedureFactsInput): ForeignBodyFacts {
  const text = input.procedureDetails ?? '';
  const site = extractForeignBodySite(input, text);
  const anatomicSite = extractSite(input, text)?.value;
  const slitLampFromTechnique = (input.technique ?? []).some((value) => SLIT_LAMP_PATTERN.test(value));

  return {
    site,
    eyeStructure: site?.value === 'eye' ? extractEyeStructure(input, text) : undefined,
    incisionDocumented: textFlag(text, INCISION_PATTERN),
    complicationElements: extractComplicationElements(text),
    slitLampDocumented: slitLampFromTechnique
      ? { value: true, evidence: fieldEvidence(TECHNIQUE_FIELD_LABEL) }
      : textFlag(text, SLIT_LAMP_PATTERN),
    withoutSlitLampDocumented: textMention(text, WITHOUT_SLIT_LAMP_PATTERN),
    descriptionDocumented: textFlag(text, FOREIGN_BODY_DESCRIPTION_PATTERN),
    outcomeDocumented: textFlag(text, OUTCOME_PATTERN),
    postAssessmentDocumented: site !== undefined ? textFlag(text, POST_ASSESSMENT_PATTERNS[site.value]) : undefined,
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    generalAnesthesiaDocumented: extractGeneralAnesthesiaDocumented(input, text),
    sizeDocumented: lesionSizeDocumented(input, text),
    lateralityRequired:
      site !== undefined &&
      (site.value !== 'skin' || (anatomicSite !== undefined && LATERALIZABLE_SKIN_SITES.includes(anatomicSite))),
    lateralityDocumented: lateralityDocumented(input, text),
  };
}

const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  laterality: { destination: 'in the Side of body field' },
  incision: { destination: TO_DETAILS, example: '"#11 blade stab incision over the foreign body"' },
  complicated: {
    destination: TO_DETAILS,
    example:
      '"deep dissection through subcutaneous tissue to reach the fragment" or "multiple foreign bodies localized by ultrasound"',
  },
  slitLamp: { destination: TO_DETAILS, example: '"corneal foreign body removed at the slit lamp with a burr"' },
  eyeStructure: {
    destination: TO_DETAILS,
    example: '"foreign body on the cornea" or "foreign body on the conjunctiva"',
  },
  description: { destination: TO_DETAILS, example: '"3 mm wooden splinter"' },
  outcome: { destination: TO_DETAILS, example: '"foreign body removed completely intact"' },
  postSkin: { destination: TO_DETAILS, example: '"hemostasis achieved"' },
  postEye: { destination: TO_DETAILS, example: '"fluorescein exam: no residual uptake"' },
  postEar: { destination: TO_DETAILS, example: '"canal without abrasion; TM intact"' },
  size: { destination: 'in the Wound/lesion size (cm) field' },
  anesthesia: {
    destination: 'in the Anaesthesia / medication used field',
    example: '"1% lidocaine" or "topical tetracaine"',
  },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

const POST_ASSESSMENT_ASKS: Record<ForeignBodySite, { ask: string; element: keyof typeof WHERE_TO_DOCUMENT }> = {
  skin: { ask: 'note hemostasis', element: 'postSkin' },
  nose: { ask: 'note hemostasis', element: 'postSkin' },
  eye: { ask: 'note the fluorescein exam', element: 'postEye' },
  ear: { ask: 'note that the TM is intact', element: 'postEar' },
};

const SITE_ASK_CLAUSE =
  'which foreign-body removal code applies depends on where the foreign body was (skin/soft tissue, nose, eye, or ear canal)';

type GeneralAnesthesiaOfficeCode =
  | typeof FOREIGN_BODY_CODES.intranasalOffice
  | typeof FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia;

const GENERAL_ANESTHESIA_CONTRADICTIONS = {
  [FOREIGN_BODY_CODES.intranasalOffice]:
    '30300 is the office-type intranasal foreign-body removal, but the note documents general anesthesia or procedural sedation — removal under general anesthesia is 30310, which this model does not assess. Topical or local anesthesia is expected with 30300 and does not affect it.',
  [FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia]:
    '69200 is removal of a foreign body from the ear canal without general anesthesia, but the note documents general anesthesia or procedural sedation — removal under general anesthesia is 69205, which this model does not assess. Topical or local anesthesia is expected with 69200 and does not affect it.',
} as const satisfies Record<GeneralAnesthesiaOfficeCode, string>;

const GENERAL_ANESTHESIA_ALTERNATIVES = {
  [FOREIGN_BODY_CODES.intranasalOffice]: FOREIGN_BODY_OUT_OF_SCOPE_CODES.intranasalUnderGeneralAnesthesia,
  [FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia]: FOREIGN_BODY_OUT_OF_SCOPE_CODES.earCanalUnderGeneralAnesthesia,
} as const satisfies Record<GeneralAnesthesiaOfficeCode, string>;

function isGeneralAnesthesiaOfficeCode(code: string): code is GeneralAnesthesiaOfficeCode {
  return code in GENERAL_ANESTHESIA_ALTERNATIVES;
}

function generalAnesthesiaNotAssessedReason(officeCode: GeneralAnesthesiaOfficeCode): string {
  return `The note documents general anesthesia or procedural sedation, which points at ${GENERAL_ANESTHESIA_ALTERNATIVES[officeCode]} rather than ${officeCode}; ${GENERAL_ANESTHESIA_ALTERNATIVES[officeCode]} is outside this model's scope and is not assessed.`;
}

const NON_CORNEAL_EYE_CODING: Record<Exclude<EyeStructure, 'cornea'>, { label: string; codes: string }> = {
  conjunctiva: { label: 'conjunctival', codes: '65205/65210' },
  eyelid: { label: 'eyelid', codes: '67938 if it is embedded, otherwise 65205/65210' },
};

function nonCornealEyeMessage(structure: Exclude<EyeStructure, 'cornea'>, subject = '65220 and 65222'): string {
  const { label, codes } = NON_CORNEAL_EYE_CODING[structure];
  const verb = subject.includes(' and ') ? 'cover' : 'covers';
  return `The note documents a ${label} foreign body, not a corneal one — ${subject} ${verb} corneal removal only, and ${label} removal (${codes}) is outside this model's scope; not assessed.`;
}

const EYE_STRUCTURE_ASK_CLAUSE =
  '65220 and 65222 cover the cornea only, so which code applies depends first on which structure the foreign body was on — conjunctival (65205/65210) and eyelid (67938) removals are coded separately and are not assessed here';

const EYE_SLIT_LAMP_ASK_CLAUSE =
  'whether a slit lamp was used selects 65222 (with slit lamp) or 65220 (without slit lamp)';
const SKIN_OPEN_CANDIDATES_SUMMARY =
  '10120–10121, or no separate procedure code — whether an incision was made decides which';
const SITE_OPEN_CANDIDATES_SUMMARY = `${Object.keys(FOREIGN_BODY_CODE_INFO).join(
  ', '
)} — the documented body site selects the branch`;

function suggestForeignBodyCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractForeignBodyFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const site = facts.site?.value;

  if (site === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Body site is not documented — ${SITE_ASK_CLAUSE}. ${whereClause('site', 'Select it')}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      Object.values(FOREIGN_BODY_CODES).map(codeCandidate),
      SITE_OPEN_CANDIDATES_SUMMARY
    );
    return evaluation;
  }

  if (site === 'nose') {
    if (facts.generalAnesthesiaDocumented) {
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: GENERAL_ANESTHESIA_CONTRADICTIONS[FOREIGN_BODY_CODES.intranasalOffice],
        evidence: citing(facts.generalAnesthesiaDocumented),
      });
      evaluation.outcome = notAssessedCode(generalAnesthesiaNotAssessedReason(FOREIGN_BODY_CODES.intranasalOffice));
      return evaluation;
    }
    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.intranasalOffice,
      display: codeCandidate(FOREIGN_BODY_CODES.intranasalOffice).display,
      justification: 'Intranasal foreign body — the nose is the documented site → 30300.',
    });
    return evaluation;
  }

  if (site === 'eye') {
    const structure = facts.eyeStructure;
    if (structure !== undefined && structure.value !== 'cornea') {
      const message = nonCornealEyeMessage(structure.value);
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message,
        evidence: citing(structure),
      });
      evaluation.outcome = notAssessedCode(message);
      return evaluation;
    }
    if (structure === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `The eye structure is not documented — ${EYE_STRUCTURE_ASK_CLAUSE}. ${whereClause(
          'eyeStructure',
          'Add which structure it was on'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    const withSlitLamp = facts.slitLampDocumented;
    const withoutSlitLamp = facts.withoutSlitLampDocumented;
    if (withSlitLamp !== undefined && withoutSlitLamp !== undefined) {
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: `The note documents both slit-lamp use and removal without a slit lamp — reconcile how the corneal foreign body was removed. ${whereClause(
          'slitLamp',
          'Correct it'
        )}`,
        evidence: citing(withoutSlitLamp),
      });
    } else if (withSlitLamp === undefined && withoutSlitLamp === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `Slit-lamp use is not documented — ${EYE_SLIT_LAMP_ASK_CLAUSE}. ${whereClause(
          'slitLamp',
          'Add whether it was used'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (findings.length > 0) {
      const candidates =
        withSlitLamp !== undefined && withoutSlitLamp === undefined
          ? [codeCandidate(FOREIGN_BODY_CODES.cornealWithSlitLamp)]
          : withoutSlitLamp !== undefined && withSlitLamp === undefined
          ? [codeCandidate(FOREIGN_BODY_CODES.cornealWithoutSlitLamp)]
          : [
              codeCandidate(FOREIGN_BODY_CODES.cornealWithoutSlitLamp),
              codeCandidate(FOREIGN_BODY_CODES.cornealWithSlitLamp),
            ];
      evaluation.outcome = openCodeSet(
        candidates,
        candidates.length === 1
          ? `${candidates[0].code} — a single conditional candidate: it applies only to a corneal foreign body`
          : `65220–65222 — ${EYE_SLIT_LAMP_ASK_CLAUSE}`
      );
      return evaluation;
    }
    const code =
      withSlitLamp !== undefined ? FOREIGN_BODY_CODES.cornealWithSlitLamp : FOREIGN_BODY_CODES.cornealWithoutSlitLamp;
    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification:
        code === FOREIGN_BODY_CODES.cornealWithSlitLamp
          ? 'Corneal foreign body — the eye is the documented site and slit-lamp use is documented → 65222.'
          : 'Corneal foreign body — the eye is the documented site and removal without a slit lamp is documented → 65220.',
    });
    return evaluation;
  }

  if (site === 'ear') {
    if (facts.generalAnesthesiaDocumented) {
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: GENERAL_ANESTHESIA_CONTRADICTIONS[FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia],
        evidence: citing(facts.generalAnesthesiaDocumented),
      });
      evaluation.outcome = notAssessedCode(
        generalAnesthesiaNotAssessedReason(FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia)
      );
      return evaluation;
    }
    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia,
      display: codeCandidate(FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia).display,
      justification: 'Foreign body in the ear canal, removed without general anesthesia → 69200.',
    });
    return evaluation;
  }

  if (!facts.incisionDocumented) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `An incision is not documented — 10120 and 10121 are defined as removal by incision; without one the removal is generally part of the visit (E/M) charge. ${whereClause(
        'incision',
        ifPerformedClause('made', 'add it')
      )}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      [
        codeCandidate(FOREIGN_BODY_CODES.skinSimple),
        codeCandidate(FOREIGN_BODY_CODES.skinComplicated),
        NO_PROCEDURE_CODE_CANDIDATE,
      ],
      SKIN_OPEN_CANDIDATES_SUMMARY
    );
    return evaluation;
  }
  if (facts.complicationElements.length > 0) {
    const documented = joinWithOr(facts.complicationElements.map((e) => COMPLICATION_ELEMENT_LABELS[e.value]));
    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.skinComplicated,
      display: codeCandidate(FOREIGN_BODY_CODES.skinComplicated).display,
      justification: `Complicated foreign-body removal — skin/soft-tissue site; incision documented with ${documented} → 10121.`,
    });
  } else {
    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.skinSimple,
      display: codeCandidate(FOREIGN_BODY_CODES.skinSimple).display,
      justification: `Simple foreign-body removal — skin/soft-tissue site; removal by incision documented with none of the complicating elements (${COMPLICATION_ELEMENT_MENU}) → 10120.`,
    });
  }
  return evaluation;
}

function defendForeignBodyCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractForeignBodyFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const site = facts.site?.value;
  const inScopeSelected = selected.filter((c) => isForeignBodyRemovalCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isForeignBodyRemovalCode(code) ? FOREIGN_BODY_CODE_INFO[code] : undefined),
    (info, code, codeFindings) => {
      if (site === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `Body site is not documented for ${code} — ${SITE_ASK_CLAUSE}. ${whereClause('site', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (site !== info.site) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers ${info.coverage}, but the note documents the foreign body in the ${SITE_BRANCH_LABELS[site]}.`,
          evidence: citing(facts.site),
        });
      } else {
        if (info.site === 'skin' && !facts.incisionDocumented) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} requires removal by incision — the note does not document an incision. ${whereClause(
              'incision',
              ifPerformedClause('made', 'add it')
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
        if (code === FOREIGN_BODY_CODES.skinComplicated && facts.complicationElements.length === 0) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `10121 is selected, but the note documents none of the elements that make a removal complicated (${COMPLICATION_ELEMENT_MENU}) — as documented this supports 10120 (simple removal by incision). ${whereClause(
              'complicated',
              ifPerformedClause('performed', 'add it', 'it')
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
        if (code === FOREIGN_BODY_CODES.cornealWithoutSlitLamp || code === FOREIGN_BODY_CODES.cornealWithSlitLamp) {
          const structure = facts.eyeStructure;
          if (structure !== undefined && structure.value !== 'cornea') {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: nonCornealEyeMessage(structure.value, code),
              evidence: citing(structure),
            });
          } else {
            if (structure === undefined) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `The eye structure is not documented for ${code} — ${EYE_STRUCTURE_ASK_CLAUSE}. ${whereClause(
                  'eyeStructure',
                  'Add which structure it was on'
                )}`,
                evidence: NOTHING_TO_CITE,
              });
            }
            if (code === FOREIGN_BODY_CODES.cornealWithSlitLamp && facts.withoutSlitLampDocumented) {
              codeFindings.push({
                level: 'contradiction',
                scope: codeScope(code),
                message:
                  '65222 requires slit-lamp use, but the note documents removal without a slit lamp — as documented this supports 65220.',
                evidence: citing(facts.withoutSlitLampDocumented),
              });
            } else if (code === FOREIGN_BODY_CODES.cornealWithSlitLamp && !facts.slitLampDocumented) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `Slit-lamp use is not documented for 65222 — ${EYE_SLIT_LAMP_ASK_CLAUSE}. ${whereClause(
                  'slitLamp',
                  'Add whether it was used'
                )}`,
                evidence: NOTHING_TO_CITE,
              });
            } else if (code === FOREIGN_BODY_CODES.cornealWithoutSlitLamp && facts.slitLampDocumented) {
              codeFindings.push({
                level: 'contradiction',
                scope: codeScope(code),
                message:
                  '65220 covers corneal removal without a slit lamp, but the note documents slit-lamp use — as documented this supports 65222.',
                evidence: citing(facts.slitLampDocumented),
              });
            } else if (code === FOREIGN_BODY_CODES.cornealWithoutSlitLamp && !facts.withoutSlitLampDocumented) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `Removal without a slit lamp is not documented for 65220 — ${EYE_SLIT_LAMP_ASK_CLAUSE}. ${whereClause(
                  'slitLamp',
                  'Add whether it was used'
                )}`,
                evidence: NOTHING_TO_CITE,
              });
            }
          }
        }

        const generalAnesthesiaContradiction = isGeneralAnesthesiaOfficeCode(code)
          ? GENERAL_ANESTHESIA_CONTRADICTIONS[code]
          : undefined;

        if (generalAnesthesiaContradiction !== undefined && facts.generalAnesthesiaDocumented) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: generalAnesthesiaContradiction,
            evidence: citing(facts.generalAnesthesiaDocumented),
          });
        }

        if (!facts.postAssessmentDocumented) {
          const { ask, element } = POST_ASSESSMENT_ASKS[info.site];
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `A post-removal assessment is not documented for ${code} — for this site, ${ask}. ${whereClause(
              element
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }

      if (facts.lateralityRequired && !facts.lateralityDocumented) {
        codeFindings.push(
          lateralityFinding(
            code,
            whereClause('laterality', 'Select it'),
            'the documented removal site is paired and should record the side'
          )
        );
      }

      if (!facts.descriptionDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The foreign body is not described for ${code} — the note should say what was removed. ${whereClause(
            'description'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.outcomeDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Complete removal is not documented for ${code} — the note should state that the foreign body came out entirely. ${whereClause(
            'outcome'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (inScopeSelected.length > 0) {
    if (site === 'skin' && !facts.sizeDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Wound/lesion size is not documented — it does not select the code, but it completes the note. ${whereClause(
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
        message: `Anesthesia is not noted — it does not affect these codes, but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}

export const foreignBodyFamily: ProcedureFamilyModel = {
  id: 'foreign-body',
  displayName: 'Foreign Body Removal',
  structuredFieldsFor: () => [ProcedureStructuredField.Length],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('foreign-body', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isForeignBodyRemovalCode(c.code))
  ),
  suggestCode: suggestForeignBodyCode,
  defendCodes: defendForeignBodyCodes,
};
