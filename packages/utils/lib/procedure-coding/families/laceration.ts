import {
  AnatomicSite,
  extractAnesthesiaDocumented,
  extractSiteFromText,
  firstMatch,
  firstPerformedMatch,
  isNegatedMatch,
  isPlausibleLengthCm,
  lateralityDocumented,
  LENGTH_UNIT_SOURCE,
  MAX_PLAUSIBLE_LENGTH_CM,
  normalizeAnatomicSite,
  normalizeNoteText,
  NUMBER_SOURCE,
  parseLengthCm,
  siteNearIndex,
  snippetAround,
  suppliesContain,
  textFlag,
  textFlagPerformed,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  defendSelectedCodes,
  DETAILS_FIELD_LABEL,
  joinWithAnd,
  LENGTH_FIELD_LABEL,
  REPAIR_DEPTH_FIELD_LABEL,
  SITE_FIELD_LABEL,
  SUPPLIES_FIELD_LABEL,
  TO_DETAILS,
  whereClauseFor,
} from '../family-support';
import {
  citing,
  CodeAssessmentKind,
  CodeCandidate,
  codeScope,
  CodeSuggestion,
  determinedCode,
  determinedCodeWithAlternates,
  emptyDefenseEvaluation,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  EvidenceSource,
  FactProvenance,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  FindingEvidence,
  FindingScopeKind,
  ifPerformedClause,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  ProcedureStructuredField,
  RepairDepthSelection,
  setCodeAssessment,
  textEvidence,
  WhereToDocument,
} from '../model.types';

export { isRepairDepthSelection, REPAIR_DEPTH_OPTIONS, repairDepthDisplayLabel } from '../format';

export type LacerationRepairClass = 'simple' | 'intermediate' | 'complex';

export type LacerationSiteGroup =
  | 'simple-trunk-extremities'
  | 'simple-face-mm'
  | 'intermediate-trunk-extremities'
  | 'intermediate-neck-hands-feet-genitalia'
  | 'intermediate-face-mm';

export type ComplexRepairSiteGroup =
  | 'complex-trunk'
  | 'complex-scalp-arms-legs'
  | 'complex-forehead-neck-hands-feet'
  | 'complex-eyelids-nose-ears-lips';

export type ComplexRepairElement =
  | 'extensive-undermining'
  | 'retention-sutures'
  | 'stents'
  | 'debridement'
  | 'exposed-structure'
  | 'free-margin';

export interface LacerationWound {
  lengthCm: number;
  site?: AnatomicSite;
  evidence: FactProvenance;
}

export interface LacerationFacts {
  site?: FactValue<AnatomicSite>;
  siteFromText?: FactValue<AnatomicSite>;
  wounds: LacerationWound[];
  duplicateLengthMention?: FactValue<true>;
  structuredLengthCm?: number;
  structuredRepairDepth?: RepairDepthSelection;
  depth?: FactValue<'layered' | 'single-layer'>;
  outsideScope?: FactValue<true>;
  complexElements: FactValue<ComplexRepairElement>[];
  closureMethod?: FactValue<string>;
  closureMaterial?: FactValue<string>;
  closureCount?: FactValue<number>;
  suturesDocumented?: FactValue<true>;
  staplesDocumented?: FactValue<true>;
  tissueAdhesiveDocumented?: FactValue<true>;
  adhesiveStripsDocumented?: FactValue<true>;
  contaminationDocumented?: FactValue<true>;
  extensiveCleaningDocumented?: FactValue<true>;
  irrigationDocumented?: FactValue<true>;
  anesthesiaDocumented?: FactValue<true>;
  tetanusDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

const LENGTH_FIGURE_PATTERN = new RegExp(String.raw`(${NUMBER_SOURCE})\s*${LENGTH_UNIT_SOURCE}\b`, 'gi');

const DIMENSION_FIGURE_PATTERN = new RegExp(
  String.raw`(${NUMBER_SOURCE})\s*(?:${LENGTH_UNIT_SOURCE}\s*)?[x×]\s*(${NUMBER_SOURCE})\s*${LENGTH_UNIT_SOURCE}\b`,
  'gi'
);

const WOUND_LENGTH_LINE_PATTERN = new RegExp(
  String.raw`wound\s+length\s*:?\s*(${NUMBER_SOURCE})(?!\d)\s*(?:${LENGTH_UNIT_SOURCE}\b)?`,
  'gi'
);

const DISTANCE_CONTEXT_PATTERN = /^\s*(?:from|proximal|distal|above|below|lateral|medial|superior|inferior)\b/i;

const PLURAL_WOUND_PATTERN =
  /\b(?:second|third|another|two|three|four|five|multiple|separate|bilateral)\b[\s\S]{0,40}\b(?:wounds?|lacerations?|lacs?|cuts?)\b|\band\s+(?:a|an|another|one)\b[\s\S]{0,40}\b(?:wounds?|lacerations?|lacs?|cuts?)\b/i;

interface RawWound extends LacerationWound {
  index: number;
}

function extractWounds(text: string): { wounds: LacerationWound[]; duplicate?: LacerationWound } {
  const raw: RawWound[] = [];
  const consumed = new Uint8Array(text.length);
  const pluralSignal = PLURAL_WOUND_PATTERN.test(text);

  const record = (index: number, matchLength: number, lengthCm: number): void => {
    raw.push({
      index,
      lengthCm,
      site: siteNearIndex(text, index, matchLength),
      evidence: textEvidence(snippetAround(text, index, matchLength)),
    });
  };
  const consume = (index: number, matchLength: number): void => {
    consumed.fill(1, index, index + matchLength);
  };
  const alreadyConsumed = (index: number, matchLength: number): boolean => {
    for (let position = index; position < index + matchLength; position += 1) {
      if (consumed[position] === 1) return true;
    }
    return false;
  };

  DIMENSION_FIGURE_PATTERN.lastIndex = 0;
  let result: RegExpExecArray | null;
  while ((result = DIMENSION_FIGURE_PATTERN.exec(text)) !== null) {
    consume(result.index, result[0].length);
    const [, firstFigure, firstUnit, secondFigure, secondUnit] = result;
    const first = parseLengthCm(firstFigure, firstUnit ?? secondUnit);
    const second = parseLengthCm(secondFigure, secondUnit);
    record(result.index, result[0].length, Math.max(first, second));
  }

  let labelledSeen = false;
  let duplicateLabel: RawWound | undefined;
  WOUND_LENGTH_LINE_PATTERN.lastIndex = 0;
  while ((result = WOUND_LENGTH_LINE_PATTERN.exec(text)) !== null) {
    if (alreadyConsumed(result.index, result[0].length)) continue;
    consume(result.index, result[0].length);
    const lengthCm = parseLengthCm(result[1], result[2]);
    if (!isPlausibleLengthCm(lengthCm)) continue;
    if (labelledSeen && !pluralSignal) {
      duplicateLabel = {
        index: result.index,
        lengthCm,
        evidence: textEvidence(snippetAround(text, result.index, result[0].length)),
      };
      continue;
    }
    labelledSeen = true;
    record(result.index, result[0].length, lengthCm);
  }

  LENGTH_FIGURE_PATTERN.lastIndex = 0;
  while ((result = LENGTH_FIGURE_PATTERN.exec(text)) !== null) {
    if (alreadyConsumed(result.index, result[0].length)) continue;
    const after = text.slice(result.index + result[0].length, result.index + result[0].length + 24);
    if (DISTANCE_CONTEXT_PATTERN.test(after)) continue; // "2 cm from the elbow" is not a wound length
    consume(result.index, result[0].length);
    const lengthCm = parseLengthCm(result[1], result[2]);
    if (!isPlausibleLengthCm(lengthCm)) continue;
    record(result.index, result[0].length, lengthCm);
  }

  const ordered = raw.filter((wound) => isPlausibleLengthCm(wound.lengthCm)).sort((a, b) => a.index - b.index);
  if (pluralSignal) {
    return { wounds: ordered.map(stripIndex), duplicate: duplicateLabel && stripIndex(duplicateLabel) };
  }

  const byLength = new Map<number, LacerationWound>();
  let duplicate: LacerationWound | undefined = duplicateLabel && stripIndex(duplicateLabel);
  for (const wound of ordered) {
    const existing = byLength.get(wound.lengthCm);
    if (existing === undefined) {
      byLength.set(wound.lengthCm, stripIndex(wound));
      continue;
    }
    if (existing.site === undefined && wound.site !== undefined) existing.site = wound.site;
    if (duplicate === undefined) duplicate = stripIndex(wound);
  }
  return { wounds: [...byLength.values()], duplicate };
}

function stripIndex(wound: RawWound | LacerationWound): LacerationWound {
  const { lengthCm, site, evidence } = wound;
  return { lengthCm, site, evidence };
}

const LAYERED_PATTERN =
  /\blayered\b|\btwo[-\s]layer|\bmulti[-\s]?layer|deep\s+dermal\s+sutur|deep\s+sutur|subcutaneous\s+sutur/i;

const SINGLE_LAYER_PATTERN =
  /single[-\s]layer(?:ed)?|superficial(?:ly)?\s+(?:clos\w+|repair\w*|sutur\w*|approximat\w+|lacerat\w*|wound)|(?:clos\w+|repair\w*|sutur\w+)\s+superficial(?:ly)?/i;

const OUTSIDE_SCOPE_PATTERN =
  /tissue\s+rearrangement|adjacent\s+tissue\s+transfer|advancement\s+flap|rotation\s+flap|z-?plasty/i;

const COMPLEX_ELEMENT_PATTERNS: Array<[ComplexRepairElement, RegExp]> = [
  [
    'extensive-undermining',
    /(?:extensive(?:ly)?|wide(?:ly)?|broad(?:ly)?)\s+undermin\w*|undermin\w*\s+(?:extensive|wide|broad)ly/i,
  ],
  ['retention-sutures', /retention\s+sutur\w*/i],
  [
    'stents',
    /(?<!\b(?:coronary|cardiac|vascular|ureteral|urethral|biliary|renal|carotid|iliac)\s)\bstent(?:s|ed|ing)?\b/i,
  ],
  ['debridement', /debrid\w*/i],
  [
    'exposed-structure',
    /\bexposed?\s+(?:the\s+)?(?:bone|cartilage|tendon|nerve|arter\w*|vessel\w*|vein\w*)|\b(?:bone|cartilage|tendon|nerve|arter\w*|vessel|vein)s?\s+(?:was\s+|were\s+|is\s+|are\s+)?exposed\b|exposure\s+of\s+(?:the\s+)?(?:bone|cartilage|tendon|nerve|arter\w*|vessel|vein)/i,
  ],
  ['free-margin', /free\s+margin|helical\s+rim|vermill?ion\s+border|nostril\s+rim/i],
];

function extractComplexElements(text: string): FactValue<ComplexRepairElement>[] {
  const elements: FactValue<ComplexRepairElement>[] = [];
  for (const [element, pattern] of COMPLEX_ELEMENT_PATTERNS) {
    const found = firstPerformedMatch(text, pattern);
    if (found) {
      elements.push({
        value: element,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      });
    }
  }
  return elements;
}

const CONTAMINATION_PATTERN =
  /heavil?y\s+contaminated|grossly\s+contaminated|heavy\s+contamination|gross\s+contamination/i;
const EXTENSIVE_CLEANING_PATTERN =
  /extensive(?:ly)?\s+(?:clean\w*|irrigat\w*|scrub\w*)|copious(?:ly)?\s+irrigat\w*|prolonged\s+(?:irrigation|cleaning|scrubbing)/i;
const IRRIGATION_PATTERN = /irrigat\w*/i;

const CLOSURE_METHOD_PATTERNS: Array<[RegExp, string]> = [
  [/simple\s+interrupted/i, 'simple interrupted'],
  [/vertical\s+mattress/i, 'vertical mattress'],
  [/horizontal\s+mattress/i, 'horizontal mattress'],
  [/running\s+subcuticular|subcuticular/i, 'subcuticular'],
  [/running\s+(?:sutur\w*|closure|stitch\w*)|\brunning\b/i, 'running'],
  [/\binterrupted\b/i, 'interrupted'],
  [/stapl(?:es?|ed|er)\b/i, 'staples'],
  [/dermabond|tissue\s+adhesive|skin\s+adhesive|skin\s+glue/i, 'tissue adhesive'],
];

const SUTURE_MATERIALS =
  'nylon|ethilon|prolene|vicryl|monocryl|chromic(?:\\s+gut)?|fast[-\\s]absorbing\\s+gut|plain\\s+gut|gut|silk|pds';
const SIZED_MATERIAL_PATTERN = new RegExp(`\\b(\\d{1,2}[-–/.]0)\\s+(${SUTURE_MATERIALS})\\b`, 'i');
const MATERIAL_ONLY_PATTERN = new RegExp(`\\b(${SUTURE_MATERIALS})\\b`, 'i');
const GAUGE_SOURCE = String.raw`\d{1,2}[-–/.]0`;
const DEEP_WINDOW_SOURCE = String.raw`(?:(?!\bskin\b)[^.;\n]){0,40}?`;
const DEEP_LAYER_CLOSURE_PATTERN = new RegExp(
  [
    String.raw`(?:deep(?:\s+dermal)?|dermal|sub-?cutaneous|subdermal)\s+(?:layers?|tissues?|plane)\b${DEEP_WINDOW_SOURCE}(?:closed|approximated|re-?approximated|sutured|repaired|${GAUGE_SOURCE}|(?:${SUTURE_MATERIALS}))`,
    String.raw`deep(?:\s+dermal)?\s+(?:${GAUGE_SOURCE}\s*)?(?:${SUTURE_MATERIALS})\b`,
    String.raw`(?:${GAUGE_SOURCE}\s+)?(?:${SUTURE_MATERIALS})\b(?:(?!\bskin\b)[^.;,\n]){0,24}?\b(?:deep|dermis|dermal|sub-?cutaneous(?:\s+(?:layers?|tissues?))?)\b`,
  ].join('|'),
  'i'
);
const SKIN_LAYER_CLOSURE_PATTERN = new RegExp(
  [
    String.raw`\bskin\b[^.;,\n]{0,16}?(?::|closed|approximated|re-?approximated|sutured|repaired|stapled)`,
    String.raw`(?:${GAUGE_SOURCE}\s+)?(?:${SUTURE_MATERIALS}|stapl\w+)\b[^.;,\n]{0,24}?(?:to|for)\s+(?:the\s+)?skin\b`,
  ].join('|'),
  'i'
);

const STITCH_COUNT_LINE_PATTERN = /total\s+(?:stitch|suture|staple)\s+count:?\s*(\d+)/i;
const COUNT_PATTERN = /(?<![\d/–-])(\d+)\s+(?:[\w–-]+\s+){0,4}?(sutures?|stitches?|staples?)\b/i;
const COUNT_X_GAUGE_PATTERN = /(?<![\d.,/–-])(\d+)\s*[x×]\s*\d{1,2}[-–/.]0\b(?!\s*(?:cm|mm))/i;

const SUTURE_EVIDENCE_PATTERN = /sutur\w*|stitch\w*/i;
const STAPLE_EVIDENCE_PATTERN = /stapl\w*/i;

const TISSUE_ADHESIVE_PATTERN =
  /dermabond|tissue\s+adhesive|skin\s+adhesive|skin\s+glue|\bglued?\b(?![^.;\n]{0,24}\b(?:dressing|bandage|gauze|drape|tape|splint)\b)/i;

const ADHESIVE_STRIPS_PATTERN = /steri[-\s]?strips?|adhesive\s+strips?|butterfly\s+(?:strips?|closures?|bandage)/i;
const TETANUS_PATTERN = /tetanus|tdap|dtap|\btd\s+(?:given|administered|up\s+to\s+date)/i;

function extractDepth(text: string): FactValue<'layered' | 'single-layer'> | undefined {
  const layered = firstMatch(text, LAYERED_PATTERN);
  if (layered) {
    return {
      value: 'layered',
      evidence: textEvidence(snippetAround(text, layered.index, layered.match.length)),
    };
  }
  const single = firstMatch(text, SINGLE_LAYER_PATTERN);

  if (single) {
    return {
      value: 'single-layer',
      evidence: textEvidence(snippetAround(text, single.index, single.match.length)),
    };
  }

  const deep = firstMatch(text, DEEP_LAYER_CLOSURE_PATTERN);
  const skin = firstMatch(text, SKIN_LAYER_CLOSURE_PATTERN);
  if (deep && skin) {
    const overlap = deep.index < skin.index + skin.match.length && skin.index < deep.index + deep.match.length;
    if (!overlap) {
      return {
        value: 'layered',
        evidence: textEvidence(snippetAround(text, deep.index, deep.match.length)),
      };
    }
  }
  return undefined;
}

function extractClosureMethod(text: string): FactValue<string> | undefined {
  for (const [pattern, method] of CLOSURE_METHOD_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      return { value: method, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    }
  }
  return undefined;
}

function extractClosureMaterial(text: string): FactValue<string> | undefined {
  const sized = firstMatch(text, SIZED_MATERIAL_PATTERN);
  if (sized) {
    return { value: sized.match, evidence: textEvidence(snippetAround(text, sized.index, sized.match.length)) };
  }
  const materialOnly = firstMatch(text, MATERIAL_ONLY_PATTERN);
  if (materialOnly) {
    return {
      value: materialOnly.match,
      evidence: textEvidence(snippetAround(text, materialOnly.index, materialOnly.match.length)),
    };
  }
  return undefined;
}

function extractClosureCount(text: string): FactValue<number> | undefined {
  for (const pattern of [STITCH_COUNT_LINE_PATTERN, COUNT_X_GAUGE_PATTERN, COUNT_PATTERN]) {
    const regex = new RegExp(pattern.source, `${pattern.flags}g`);
    let result: RegExpExecArray | null;
    while ((result = regex.exec(text)) !== null) {
      if (isNegatedMatch(text, result.index, result[0].length)) continue;
      const count = parseInt(result[1], 10);
      if (!Number.isFinite(count) || count <= 0) continue;
      return { value: count, evidence: textEvidence(snippetAround(text, result.index, result[0].length)) };
    }
  }
  return undefined;
}

/** Deterministic laceration fact extraction: structured fields first, then details-text patterns. */
export function extractLacerationFacts(input: ProcedureFactsInput): LacerationFacts {
  const text = normalizeNoteText(input.procedureDetails);
  const structuredSite = normalizeAnatomicSite(input.bodySite) ?? normalizeAnatomicSite(input.otherBodySite);
  const siteFromText = extractSiteFromText(text);
  const { wounds, duplicate } = extractWounds(text);

  const facts: LacerationFacts = {
    site: structuredSite ? { value: structuredSite, evidence: fieldEvidence(SITE_FIELD_LABEL) } : siteFromText,
    siteFromText,
    wounds,
    duplicateLengthMention: duplicate === undefined ? undefined : { value: true, evidence: duplicate.evidence },
    structuredLengthCm: input.lengthCm,
    structuredRepairDepth: input.repairDepth,
    depth: extractDepth(text),
    outsideScope: textFlag(text, OUTSIDE_SCOPE_PATTERN),
    complexElements: extractComplexElements(text),
    closureMethod: extractClosureMethod(text),
    closureMaterial: extractClosureMaterial(text),
    closureCount: extractClosureCount(text),
    suturesDocumented: textFlag(text, SUTURE_EVIDENCE_PATTERN),
    staplesDocumented: textFlag(text, STAPLE_EVIDENCE_PATTERN),
    tissueAdhesiveDocumented: textFlag(text, TISSUE_ADHESIVE_PATTERN),
    adhesiveStripsDocumented: textFlag(text, ADHESIVE_STRIPS_PATTERN),
    contaminationDocumented: textFlag(text, CONTAMINATION_PATTERN),
    extensiveCleaningDocumented: textFlagPerformed(text, EXTENSIVE_CLEANING_PATTERN),
    // Irrigation is a best-practice element, so planned or discussed irrigation must not satisfy it.
    irrigationDocumented: textFlagPerformed(text, IRRIGATION_PATTERN),
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    tetanusDocumented: textFlag(text, TETANUS_PATTERN),
    lateralityDocumented: lateralityDocumented(input, text),
  };

  if (!facts.suturesDocumented && suppliesContain(input, /sutur/i)) {
    facts.suturesDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }
  if (!facts.staplesDocumented && suppliesContain(input, /stapl/i)) {
    facts.staplesDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }
  if (!facts.tissueAdhesiveDocumented && suppliesContain(input, /dermabond|adhesive(?!\s+strip)|glue/i)) {
    facts.tissueAdhesiveDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }

  if (!facts.adhesiveStripsDocumented && suppliesContain(input, ADHESIVE_STRIPS_PATTERN)) {
    facts.adhesiveStripsDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }

  return facts;
}

interface CodeBand {
  code: string;
  minCm: number;
  maxCm: number | null;
}

interface CodeSeries {
  group: LacerationSiteGroup;
  repairClass: LacerationRepairClass;
  classLabel: 'Simple' | 'Intermediate';
  groupLabel: string;
  bands: CodeBand[];
}

const LACERATION_CODES = {
  simpleTrunkExtremities: {
    upTo2_5Cm: '12001',
    from2_6To7_5Cm: '12002',
    from7_6To12_5Cm: '12004',
    from12_6To20Cm: '12005',
    from20_1To30Cm: '12006',
    over30Cm: '12007',
  },
  simpleFaceMucousMembranes: {
    upTo2_5Cm: '12011',
    from2_6To5Cm: '12013',
    from5_1To7_5Cm: '12014',
    from7_6To12_5Cm: '12015',
    from12_6To20Cm: '12016',
    from20_1To30Cm: '12017',
    over30Cm: '12018',
  },
  intermediateTrunkExtremities: {
    upTo2_5Cm: '12031',
    from2_6To7_5Cm: '12032',
    from7_6To12_5Cm: '12034',
    from12_6To20Cm: '12035',
    from20_1To30Cm: '12036',
    over30Cm: '12037',
  },
  intermediateNeckHandsFeetGenitalia: {
    upTo2_5Cm: '12041',
    from2_6To7_5Cm: '12042',
    from7_6To12_5Cm: '12044',
    from12_6To20Cm: '12045',
    from20_1To30Cm: '12046',
    over30Cm: '12047',
  },
  intermediateFaceMucousMembranes: {
    upTo2_5Cm: '12051',
    from2_6To7_5Cm: '12052',
    from7_6To12_5Cm: '12054',
    from12_6To20Cm: '12055',
    from20_1To30Cm: '12056',
    over30Cm: '12057',
  },
  complexTrunk: { base: '13100', second: '13101', addOn: '13102' },
  complexScalpArmsLegs: { base: '13120', second: '13121', addOn: '13122' },
  complexForeheadNeckHandsFeet: { base: '13131', second: '13132', addOn: '13133' },
  complexEyelidsNoseEarsLips: { base: '13151', second: '13152', addOn: '13153' },
  deletedComplexUpTo1Cm: '13150',
  tissueAdhesiveOnlyMedicare: 'G0168',
} as const;

const LACERATION_CODE_SERIES: CodeSeries[] = [
  {
    group: 'simple-trunk-extremities',
    repairClass: 'simple',
    classLabel: 'Simple',
    groupLabel: 'scalp/neck/axillae/genitalia/trunk/extremities (including hands and feet)',
    bands: [
      { code: LACERATION_CODES.simpleTrunkExtremities.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.simpleTrunkExtremities.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'simple-face-mm',
    repairClass: 'simple',
    classLabel: 'Simple',
    groupLabel: 'face/ears/eyelids/nose/lips/mucous membranes',
    bands: [
      { code: LACERATION_CODES.simpleFaceMucousMembranes.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from2_6To5Cm, minCm: 2.6, maxCm: 5.0 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from5_1To7_5Cm, minCm: 5.1, maxCm: 7.5 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-trunk-extremities',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'scalp/axillae/trunk/extremities (excluding hands and feet)',
    bands: [
      { code: LACERATION_CODES.intermediateTrunkExtremities.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-neck-hands-feet-genitalia',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'neck/hands/feet/genitalia',
    bands: [
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-face-mm',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'face/ears/eyelids/nose/lips/mucous membranes',
    bands: [
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
];

interface IndexedCode {
  series: CodeSeries;
  band: CodeBand;
  bandIndex: number;
}

const LACERATION_CODE_INDEX: Record<string, IndexedCode> = {};
const SERIES_BY_GROUP: Record<LacerationSiteGroup, CodeSeries> = {} as Record<LacerationSiteGroup, CodeSeries>;
for (const series of LACERATION_CODE_SERIES) {
  SERIES_BY_GROUP[series.group] = series;
  series.bands.forEach((band, bandIndex) => {
    LACERATION_CODE_INDEX[band.code] = { series, band, bandIndex };
  });
}

export function isLacerationRepairCode(code: string): boolean {
  return Boolean(LACERATION_CODE_INDEX[code]);
}

const DELETED_COMPLEX_CODES: string[] = [LACERATION_CODES.deletedComplexUpTo1Cm];

/** Complex repair range (131xx-133xx) — 13100-13153 are modeled; the rest stay not assessed. */
export function isComplexRepairCode(code: string): boolean {
  return /^13[123]\d{2}$/.test(code) && !DELETED_COMPLEX_CODES.includes(code);
}

export const COMPLEX_REPAIR_MIN_CM = 1.1;
const COMPLEX_BASE_MAX_CM = 2.5;
const COMPLEX_SECOND_MIN_CM = 2.6;
const COMPLEX_SECOND_MAX_CM = 7.5;
const COMPLEX_ADD_ON_INCREMENT_CM = 5;
const LENGTH_COMPARISON_EPSILON_CM = 1e-9;
const STRUCTURED_TEXT_LENGTH_MISMATCH_TOLERANCE_CM = 0.05;
const LENGTH_DISPLAY_INCREMENT_CM = 0.1;
const LENGTH_DISPLAY_ROUNDING_FACTOR = 10;

interface ComplexCodeSeries {
  group: ComplexRepairSiteGroup;
  groupLabel: string;
  baseCode: string;
  secondCode: string;
  addOnCode: string;
}

const COMPLEX_CODE_SERIES: ComplexCodeSeries[] = [
  {
    group: 'complex-trunk',
    groupLabel: 'trunk',
    baseCode: LACERATION_CODES.complexTrunk.base,
    secondCode: LACERATION_CODES.complexTrunk.second,
    addOnCode: LACERATION_CODES.complexTrunk.addOn,
  },
  {
    group: 'complex-scalp-arms-legs',
    groupLabel: 'scalp/arms/legs',
    baseCode: LACERATION_CODES.complexScalpArmsLegs.base,
    secondCode: LACERATION_CODES.complexScalpArmsLegs.second,
    addOnCode: LACERATION_CODES.complexScalpArmsLegs.addOn,
  },
  {
    group: 'complex-forehead-neck-hands-feet',
    groupLabel: 'forehead/cheeks/chin/mouth/neck/axillae/genitalia/hands/feet',
    baseCode: LACERATION_CODES.complexForeheadNeckHandsFeet.base,
    secondCode: LACERATION_CODES.complexForeheadNeckHandsFeet.second,
    addOnCode: LACERATION_CODES.complexForeheadNeckHandsFeet.addOn,
  },
  {
    group: 'complex-eyelids-nose-ears-lips',
    groupLabel: 'eyelids/nose/ears/lips',
    baseCode: LACERATION_CODES.complexEyelidsNoseEarsLips.base,
    secondCode: LACERATION_CODES.complexEyelidsNoseEarsLips.second,
    addOnCode: LACERATION_CODES.complexEyelidsNoseEarsLips.addOn,
  },
];

type ComplexCodeRole = 'base' | 'second' | 'addOn';

interface IndexedComplexCode {
  series: ComplexCodeSeries;
  role: ComplexCodeRole;
}

const COMPLEX_CODE_INDEX: Record<string, IndexedComplexCode> = {};
const COMPLEX_SERIES_BY_GROUP = {} as Record<ComplexRepairSiteGroup, ComplexCodeSeries>;
for (const series of COMPLEX_CODE_SERIES) {
  COMPLEX_SERIES_BY_GROUP[series.group] = series;
  COMPLEX_CODE_INDEX[series.baseCode] = { series, role: 'base' };
  COMPLEX_CODE_INDEX[series.secondCode] = { series, role: 'second' };
  COMPLEX_CODE_INDEX[series.addOnCode] = { series, role: 'addOn' };
}

const COMPLEX_ELEMENT_LABELS: Record<ComplexRepairElement, string> = {
  'extensive-undermining': 'extensive undermining',
  'retention-sutures': 'retention sutures',
  stents: 'stent placement',
  debridement: 'debridement of wound edges/devitalized tissue',
  'exposed-structure': 'exposed bone/cartilage/tendon/neurovascular structure',
  'free-margin': 'free-margin involvement',
};

const COMPLEX_ELEMENT_MENU =
  'extensive undermining, retention sutures, stents, debridement, exposed bone/cartilage/tendon, or free-margin involvement';

function complexElementList(facts: LacerationFacts): string {
  return facts.complexElements.map((element) => COMPLEX_ELEMENT_LABELS[element.value]).join(', ');
}

export const LACERATION_TISSUE_ADHESIVE_PAYER_NOTE =
  'Payer note: for tissue-adhesive-only closure, Medicare professional claims may report HCPCS G0168; under OPPS, facilities report the appropriate CPT repair code because G0168 is not recognized for payment. Commercial-payer handling varies.';

const G0168_CANDIDATE: CodeCandidate = {
  code: LACERATION_CODES.tissueAdhesiveOnlyMedicare,
  display: 'G0168 — Wound closure utilizing tissue adhesive(s) only (Medicare)',
};

export const LACERATION_CONTAMINATION_PAYER_NOTE =
  'Payer note: an intermediate repair claimed for a single-layer closure of a heavily contaminated wound requiring extensive cleansing is a frequent denial and audit target; the note should state both the contamination and the cleansing that was performed.';

const REPAIR_DEPTH_SELECTION_CLASS: Record<
  Exclude<RepairDepthSelection, 'tissue-adhesive-only' | 'strips-only'>,
  LacerationRepairClass
> = {
  'superficial-single': 'simple',
  'subcutaneous-single': 'simple',
  'subcutaneous-layered': 'intermediate',
  'fascia-muscle-layered': 'intermediate',
};

const OUTSIDE_SCOPE_MESSAGE =
  'The note documents tissue rearrangement (e.g. a flap or Z-plasty) — that points to an adjacent tissue transfer (CPT 14000-series), which these documentation checks do not cover; not assessed.';

const WHERE_TO_DOCUMENT = {
  site: { destination: `in the ${SITE_FIELD_LABEL} field` },
  laterality: { destination: 'in the Side of body field' },
  length: { destination: `in the ${LENGTH_FIELD_LABEL} field` },
  depth: {
    destination: `in the ${REPAIR_DEPTH_FIELD_LABEL} field, or describe the closure in ${DETAILS_FIELD_LABEL}`,
    example: '"Layered closure" or "Single-layer closure"',
  },
  sutureClosure: { destination: TO_DETAILS, example: '"5 x 4-0 nylon, simple interrupted"' },
  complexElement: { destination: TO_DETAILS, example: '"extensive undermining performed; retention sutures placed"' },
  stapleClosure: { destination: TO_DETAILS, example: '"4 staples"' },
  extensiveCleaning: { destination: TO_DETAILS, example: '"copiously irrigated with 500 mL saline"' },
  anesthesia: { destination: 'in the Anaesthesia / medication used field', example: '"3 mL 1% lidocaine"' },
  irrigation: { destination: TO_DETAILS, example: '"irrigated with 250 mL normal saline"' },
  tetanus: { destination: TO_DETAILS, example: '"tetanus up to date"' },
  separateWounds: { destination: TO_DETAILS, example: '"second 3 cm laceration of the right forearm"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

const FACE_MM_SITES: AnatomicSite[] = ['face', 'ear', 'eyelid', 'nose', 'lip', 'mucous-membrane'];
const INTERMEDIATE_NHFG_SITES: AnatomicSite[] = ['neck', 'hand', 'foot', 'genitalia'];
const COMPLEX_ENEL_SITES: AnatomicSite[] = ['eyelid', 'nose', 'ear', 'lip'];

export function complexRepairSiteGroup(site: AnatomicSite): ComplexRepairSiteGroup {
  if (COMPLEX_ENEL_SITES.includes(site)) return 'complex-eyelids-nose-ears-lips';
  if (site === 'trunk') return 'complex-trunk';
  if (site === 'scalp' || site === 'extremity') return 'complex-scalp-arms-legs';
  return 'complex-forehead-neck-hands-feet';
}

export function lacerationSiteGroup(repairClass: 'simple' | 'intermediate', site: AnatomicSite): LacerationSiteGroup;
export function lacerationSiteGroup(
  repairClass: LacerationRepairClass,
  site: AnatomicSite
): LacerationSiteGroup | ComplexRepairSiteGroup;
export function lacerationSiteGroup(
  repairClass: LacerationRepairClass,
  site: AnatomicSite
): LacerationSiteGroup | ComplexRepairSiteGroup {
  if (repairClass === 'complex') {
    return complexRepairSiteGroup(site);
  }
  if (FACE_MM_SITES.includes(site)) {
    return repairClass === 'simple' ? 'simple-face-mm' : 'intermediate-face-mm';
  }
  if (repairClass === 'simple') {
    return 'simple-trunk-extremities';
  }
  return INTERMEDIATE_NHFG_SITES.includes(site)
    ? 'intermediate-neck-hands-feet-genitalia'
    : 'intermediate-trunk-extremities';
}

const SITE_LABELS: Record<AnatomicSite, string> = {
  scalp: 'scalp',
  face: 'face',
  ear: 'ear',
  eyelid: 'eyelid',
  nose: 'nose',
  lip: 'lip',
  'mucous-membrane': 'mucous membrane',
  neck: 'neck',
  axilla: 'axilla',
  genitalia: 'genitalia',
  trunk: 'trunk',
  extremity: 'extremity',
  hand: 'hand',
  foot: 'foot',
};

const LATERALIZABLE_SITES: AnatomicSite[] = ['extremity', 'hand', 'foot', 'ear', 'eyelid', 'axilla'];

function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
}

type RepairBasis =
  | 'layered'
  | 'single-layer'
  | 'contaminated'
  | 'adhesive'
  | 'complex-element'
  | 'structured-layered'
  | 'structured-single'
  | 'structured-adhesive'
  | 'structured-strips';

const STRUCTURED_BASES: RepairBasis[] = [
  'structured-layered',
  'structured-single',
  'structured-adhesive',
  'structured-strips',
];

export enum RepairClassOutcome {
  OutsideScope = 'outside-scope',
  Resolved = 'resolved',
  Undetermined = 'undetermined',
}

export interface OutsideScopeRepair {
  kind: RepairClassOutcome.OutsideScope;
  evidence: FactProvenance;
}

export interface ResolvedRepairClass {
  kind: RepairClassOutcome.Resolved;
  repairClass: LacerationRepairClass;
  basis: RepairBasis;
  evidence: FactProvenance;
}

export interface UndeterminedRepairClass {
  kind: RepairClassOutcome.Undetermined;
}

export type RepairClassResolution = OutsideScopeRepair | ResolvedRepairClass | UndeterminedRepairClass;

function resolvedClassOf(resolution: RepairClassResolution): LacerationRepairClass | undefined {
  return resolution.kind === RepairClassOutcome.Resolved ? resolution.repairClass : undefined;
}

function resolvedBasisOf(resolution: RepairClassResolution): RepairBasis | undefined {
  return resolution.kind === RepairClassOutcome.Resolved ? resolution.basis : undefined;
}

function resolutionEvidence(resolution: RepairClassResolution): FindingEvidence {
  return resolution.kind === RepairClassOutcome.Undetermined ? NOTHING_TO_CITE : resolution.evidence;
}

function sutureEvidence(facts: LacerationFacts): boolean {
  return Boolean(
    facts.suturesDocumented ||
      facts.closureCount ||
      facts.closureMaterial ||
      (facts.closureMethod && !['staples', 'tissue adhesive'].includes(facts.closureMethod.value))
  );
}

function stapleEvidence(facts: LacerationFacts): boolean {
  return Boolean(facts.staplesDocumented || facts.closureMethod?.value === 'staples');
}

function tissueAdhesiveOnly(facts: LacerationFacts): FactValue<true> | undefined {
  const adhesive = facts.tissueAdhesiveDocumented;
  return adhesive !== undefined && !sutureEvidence(facts) && !stapleEvidence(facts) ? adhesive : undefined;
}

function adhesiveStripsOnly(facts: LacerationFacts): boolean {
  return (
    Boolean(facts.adhesiveStripsDocumented) &&
    !sutureEvidence(facts) &&
    !stapleEvidence(facts) &&
    !facts.tissueAdhesiveDocumented
  );
}

function contaminatedIntermediate(facts: LacerationFacts): FactValue<true> | undefined {
  return facts.contaminationDocumented !== undefined && facts.extensiveCleaningDocumented !== undefined
    ? facts.contaminationDocumented
    : undefined;
}

export function resolveRepairClass(facts: LacerationFacts): RepairClassResolution {
  if (facts.outsideScope !== undefined) {
    return { kind: RepairClassOutcome.OutsideScope, evidence: facts.outsideScope.evidence };
  }
  const selection = facts.structuredRepairDepth;
  if (selection === 'tissue-adhesive-only') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'structured-adhesive',
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    };
  }
  if (selection === 'strips-only') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'structured-strips',
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    };
  }
  const complexElement = facts.complexElements[0];
  if (selection !== undefined) {
    if (REPAIR_DEPTH_SELECTION_CLASS[selection] === 'intermediate') {
      if (complexElement) {
        return {
          kind: RepairClassOutcome.Resolved,
          repairClass: 'complex',
          basis: 'complex-element',
          evidence: complexElement.evidence,
        };
      }
      return {
        kind: RepairClassOutcome.Resolved,
        repairClass: 'intermediate',
        basis: 'structured-layered',
        evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
      };
    }
    const contaminated = contaminatedIntermediate(facts);
    if (contaminated !== undefined) {
      return {
        kind: RepairClassOutcome.Resolved,
        repairClass: 'intermediate',
        basis: 'contaminated',
        evidence: contaminated.evidence,
      };
    }

    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'structured-single',
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    };
  }

  if (complexElement && facts.depth?.value !== 'single-layer') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'complex',
      basis: 'complex-element',
      evidence: complexElement.evidence,
    };
  }
  if (facts.depth?.value === 'layered') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'intermediate',
      basis: 'layered',
      evidence: facts.depth.evidence,
    };
  }

  const contaminated = contaminatedIntermediate(facts);
  if (contaminated !== undefined) {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'intermediate',
      basis: 'contaminated',
      evidence: contaminated.evidence,
    };
  }
  if (facts.depth?.value === 'single-layer') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'single-layer',
      evidence: facts.depth.evidence,
    };
  }
  const adhesiveOnly = tissueAdhesiveOnly(facts);
  if (adhesiveOnly !== undefined) {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'adhesive',
      evidence: adhesiveOnly.evidence,
    };
  }
  return { kind: RepairClassOutcome.Undetermined };
}

const CLASS_BASIS_DESCRIPTIONS: Record<RepairBasis, string> = {
  layered: 'layered closure documented',
  'single-layer': 'single-layer closure documented',
  'structured-layered': `layered closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  'structured-single': `single-layer closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  'structured-adhesive': `tissue-adhesive-only closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  'structured-strips': `adhesive-strips-only closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  contaminated:
    'single-layer closure of a heavily contaminated wound with extensive cleaning documented (together these qualify as an intermediate repair)',
  'complex-element': 'complex-repair element documented',
  adhesive: 'tissue-adhesive closure documented',
};

function classBasisDescription(basis: RepairBasis | undefined): string {
  return basis === undefined ? CLASS_BASIS_DESCRIPTIONS['single-layer'] : CLASS_BASIS_DESCRIPTIONS[basis];
}

const RECONCILE_CLAUSE = 'please reconcile them; the checks use the value from the field.';

function repairDepthMismatchFinding(facts: LacerationFacts): Finding | undefined {
  const selection = facts.structuredRepairDepth;
  if (selection === undefined) return undefined;
  if (selection === 'tissue-adhesive-only' || selection === 'strips-only') {
    const sutures = sutureEvidence(facts);
    const staples = stapleEvidence(facts);
    if (!sutures && !staples) return undefined;
    const closureEvidence = sutures && staples ? 'sutures and staples' : staples ? 'staples' : 'sutures';
    const fieldClosure =
      selection === 'tissue-adhesive-only'
        ? 'a tissue-adhesive-only closure (no sutures or staples)'
        : 'closure with adhesive strips only (no sutures or staples)';
    return {
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents ${fieldClosure}, but the ${DETAILS_FIELD_LABEL} text documents ${closureEvidence} — ${RECONCILE_CLAUSE}`,
      evidence: citing(
        facts.suturesDocumented ??
          facts.staplesDocumented ??
          facts.closureMethod ??
          facts.closureMaterial ??
          facts.closureCount
      ),
    };
  }
  if (facts.depth === undefined) return undefined;
  const fieldClass = REPAIR_DEPTH_SELECTION_CLASS[selection];
  const textClass: LacerationRepairClass = facts.depth.value === 'layered' ? 'intermediate' : 'simple';
  if (fieldClass === textClass) return undefined;
  const classDescription = (repairClass: LacerationRepairClass): string =>
    repairClass === 'intermediate' ? 'a layered closure' : 'a single-layer closure';
  return {
    level: 'contradiction',
    scope: ENTRY_SCOPE,
    message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents ${classDescription(
      fieldClass
    )}, but the ${DETAILS_FIELD_LABEL} text documents ${classDescription(textClass)} — ${RECONCILE_CLAUSE}`,
    evidence: citing(facts.depth),
  };
}

function siteMismatchFinding(facts: LacerationFacts): Finding | undefined {
  if (facts.site?.evidence.source !== EvidenceSource.Field) return undefined;
  const fieldSite = facts.site.value;
  const textSite = facts.siteFromText?.value;
  if (textSite === undefined || textSite === fieldSite) return undefined;
  return {
    level: 'contradiction',
    scope: ENTRY_SCOPE,
    message: `The ${SITE_FIELD_LABEL} field documents ${withArticle(
      SITE_LABELS[fieldSite]
    )} wound, but the ${DETAILS_FIELD_LABEL} text documents ${withArticle(
      SITE_LABELS[textSite]
    )} wound — ${RECONCILE_CLAUSE}`,
    evidence: citing(facts.siteFromText),
  };
}

interface WoundTotals {
  totalCm?: number;
  totalEvidence?: FactProvenance;
  otherGroupWounds: LacerationWound[];
  mismatchFinding?: Finding;
  lengthIssueFinding?: Finding;
}

function implausibleLengthFinding(value: number): Finding {
  const shown = Number.isFinite(value) ? `${value}` : 'a value that is not a number';
  return {
    level: 'determines',
    scope: ENTRY_SCOPE,
    message: `The ${LENGTH_FIELD_LABEL} field holds ${shown}, which cannot be a repaired wound length — the exact code depends on the total repaired length, from 0.1 up to ${formatCm(
      MAX_PLAUSIBLE_LENGTH_CM
    )} cm. ${whereClause('length', 'Enter the measured length')}`,
    evidence: fieldEvidence(LENGTH_FIELD_LABEL),
  };
}

function computeWoundTotals(
  facts: LacerationFacts,
  repairClass: LacerationRepairClass | undefined,
  entrySite: AnatomicSite | undefined
): WoundTotals {
  const primaryWounds: LacerationWound[] = [];
  const otherGroupWounds: LacerationWound[] = [];
  for (const wound of facts.wounds) {
    const woundSite = wound.site ?? entrySite;
    if (entrySite === undefined || woundSite === undefined) {
      primaryWounds.push(wound);
      continue;
    }
    const sameGroup =
      repairClass !== undefined
        ? lacerationSiteGroup(repairClass, woundSite) === lacerationSiteGroup(repairClass, entrySite)
        : woundSite === entrySite; // class unknown: only same-site wounds are provably same-group
    if (sameGroup) {
      primaryWounds.push(wound);
    } else {
      otherGroupWounds.push(wound);
    }
  }

  const textSum = primaryWounds.length > 0 ? roundCm(primaryWounds.reduce((sum, w) => sum + w.lengthCm, 0)) : undefined;
  const textEvidenceForSum = primaryWounds[0]?.evidence;

  const result: WoundTotals = { otherGroupWounds };
  const structuredLengthCm = facts.structuredLengthCm;
  if (structuredLengthCm !== undefined && !isPlausibleLengthCm(structuredLengthCm)) {
    result.lengthIssueFinding = implausibleLengthFinding(structuredLengthCm);
  } else if (structuredLengthCm !== undefined) {
    result.totalCm = structuredLengthCm;
    result.totalEvidence = fieldEvidence(LENGTH_FIELD_LABEL);
    if (
      textSum !== undefined &&
      Math.abs(textSum - roundCm(structuredLengthCm)) > STRUCTURED_TEXT_LENGTH_MISMATCH_TOLERANCE_CM
    ) {
      result.mismatchFinding = {
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: `The ${LENGTH_FIELD_LABEL} field documents ${formatCm(
          structuredLengthCm
        )} cm, but the ${DETAILS_FIELD_LABEL} text documents ${formatCm(textSum)} cm — ${RECONCILE_CLAUSE}`,
        evidence: textEvidenceForSum ?? NOTHING_TO_CITE,
      };
    }
    return result;
  }
  if (textSum !== undefined) {
    result.totalCm = textSum;
    result.totalEvidence = textEvidenceForSum;
  }
  return result;
}

function roundCm(value: number): number {
  return Math.round(value * LENGTH_DISPLAY_ROUNDING_FACTOR) / LENGTH_DISPLAY_ROUNDING_FACTOR;
}

function formatCm(value: number): string {
  return value.toFixed(1);
}

function bandLowerBound(series: CodeSeries, bandIndex: number): number {
  return bandIndex === 0 ? 0 : series.bands[bandIndex - 1].maxCm ?? 0;
}

function lengthFitsBand(indexed: IndexedCode, lengthCm: number): boolean {
  const lower = bandLowerBound(indexed.series, indexed.bandIndex);
  const upperOk = indexed.band.maxCm === null || lengthCm <= indexed.band.maxCm + LENGTH_COMPARISON_EPSILON_CM;
  return lengthCm > lower + LENGTH_COMPARISON_EPSILON_CM && upperOk;
}

function bandForLength(series: CodeSeries, lengthCm: number): CodeBand {
  for (const band of series.bands) {
    if (band.maxCm === null || lengthCm <= band.maxCm + LENGTH_COMPARISON_EPSILON_CM) {
      return band;
    }
  }
  return series.bands[series.bands.length - 1];
}

function bandLabel(band: CodeBand): string {
  if (band.maxCm === null) return `>${formatCm(band.minCm - LENGTH_DISPLAY_INCREMENT_CM)} cm`;
  if (band.minCm === 0) return `≤${formatCm(band.maxCm)} cm`;
  return `${formatCm(band.minCm)}–${formatCm(band.maxCm)} cm`;
}

function codeCandidate(series: CodeSeries, band: CodeBand): CodeCandidate {
  return {
    code: band.code,
    display: `${band.code} — ${series.classLabel} repair, ${series.groupLabel}, ${bandLabel(band)}`,
  };
}

function complexAddOnUnits(totalCm: number): number {
  return Math.max(
    0,
    Math.ceil((totalCm - COMPLEX_SECOND_MAX_CM) / COMPLEX_ADD_ON_INCREMENT_CM - LENGTH_COMPARISON_EPSILON_CM)
  );
}

function complexBandLabel(role: ComplexCodeRole): string {
  if (role === 'base') return `${formatCm(COMPLEX_REPAIR_MIN_CM)}–${COMPLEX_BASE_MAX_CM} cm`;
  if (role === 'second') return `${COMPLEX_SECOND_MIN_CM}–${COMPLEX_SECOND_MAX_CM} cm`;
  return `each additional ${COMPLEX_ADD_ON_INCREMENT_CM} cm (or part) beyond ${COMPLEX_SECOND_MAX_CM} cm`;
}

function complexCodeForRole(series: ComplexCodeSeries, role: ComplexCodeRole): string {
  return role === 'base' ? series.baseCode : role === 'second' ? series.secondCode : series.addOnCode;
}

function complexCodeCandidate(series: ComplexCodeSeries, role: ComplexCodeRole): CodeCandidate {
  const code = complexCodeForRole(series, role);
  return { code, display: `${code} — Complex repair, ${series.groupLabel}, ${complexBandLabel(role)}` };
}

function wideOpenSetSummary(
  candidates: CodeCandidate[],
  entry: Pick<EntryResolution, 'repairClass' | 'totals'>,
  entrySite: AnatomicSite | undefined
): string {
  const codes = candidates.map((candidate) => candidate.code).sort();
  const span = codes[0] === codes[codes.length - 1] ? codes[0] : `${codes[0]}–${codes[codes.length - 1]}`;
  const open = [
    entrySite === undefined ? 'the body site' : undefined,
    entry.repairClass === undefined ? 'the repair depth' : undefined,
    entry.totals.totalCm === undefined ? 'the total repaired length (cm)' : undefined,
  ].filter((part): part is string => part !== undefined);
  return `${span} — ${joinWithAnd(open)} determine${open.length === 1 ? 's' : ''} the exact code`;
}

function openSetSummary(
  candidates: CodeCandidate[],
  entry: Pick<EntryResolution, 'repairClass' | 'totals'>,
  entrySite: AnatomicSite | undefined
): string {
  const { repairClass } = entry;
  if (repairClass !== undefined && entrySite !== undefined && entry.totals.totalCm === undefined) {
    if (repairClass === 'complex') {
      const series = COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)];
      return `${series.baseCode}–${series.addOnCode} — wound length (cm) determines the exact code`;
    }
    const bands = SERIES_BY_GROUP[lacerationSiteGroup(repairClass, entrySite)].bands;
    return `${bands[0].code}–${bands[bands.length - 1].code} — wound length (cm) determines the exact code`;
  }
  return wideOpenSetSummary(candidates, entry, entrySite);
}

function candidatesFor(
  repairClass: LacerationRepairClass | undefined,
  entrySite: AnatomicSite | undefined
): CodeCandidate[] {
  if (repairClass === 'complex') {
    const complexSeriesList =
      entrySite !== undefined ? [COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)]] : COMPLEX_CODE_SERIES;
    return complexSeriesList.flatMap((series) =>
      (['base', 'second', 'addOn'] as ComplexCodeRole[]).map((role) => complexCodeCandidate(series, role))
    );
  }
  let seriesList: CodeSeries[];
  if (repairClass !== undefined && entrySite !== undefined) {
    seriesList = [SERIES_BY_GROUP[lacerationSiteGroup(repairClass, entrySite)]];
  } else if (repairClass !== undefined) {
    seriesList = LACERATION_CODE_SERIES.filter((s) => s.repairClass === repairClass);
  } else if (entrySite !== undefined) {
    seriesList = [
      SERIES_BY_GROUP[lacerationSiteGroup('simple', entrySite)],
      SERIES_BY_GROUP[lacerationSiteGroup('intermediate', entrySite)],
    ];
  } else {
    seriesList = LACERATION_CODE_SERIES;
  }
  return seriesList.flatMap((series) => series.bands.map((band) => codeCandidate(series, band)));
}

function pushUnique(findings: Finding[], finding: Finding | undefined): void {
  if (finding === undefined) return;
  if (findings.some((existing) => existing.message === finding.message)) return;
  findings.push(finding);
}

function otherGroupAdvisories(
  otherGroupWounds: LacerationWound[],
  repairClass: LacerationRepairClass | undefined
): Finding[] {
  return otherGroupWounds.map((wound) => ({
    level: 'bestPractice' as const,
    scope: ENTRY_SCOPE,
    message: `The note also documents a ${formatCm(wound.lengthCm)} cm wound on the ${
      wound.site ? SITE_LABELS[wound.site] : 'documented site'
    } — ${
      repairClass ? `for ${repairClass} repairs, ` : ''
    }that site is coded separately from this entry's site, so the lengths are not added together. That wound needs its own procedure entry.`,
    evidence: citing(wound),
  }));
}

function duplicateLengthAdvisory(facts: LacerationFacts): Finding | undefined {
  if (!facts.duplicateLengthMention) return undefined;
  return {
    level: 'bestPractice',
    scope: ENTRY_SCOPE,
    message: `The note repeats the same wound length more than once — the checks count it as one wound, so the total repaired length is not inflated. If these were separate wounds, describe each one. ${whereClause(
      'separateWounds'
    )}`,
    evidence: citing(facts.duplicateLengthMention),
  };
}

function missingClosureElements(facts: LacerationFacts): string[] {
  if (
    facts.structuredRepairDepth === 'tissue-adhesive-only' ||
    facts.closureMethod?.value === 'tissue adhesive' ||
    tissueAdhesiveOnly(facts)
  ) {
    return [];
  }
  const missing: string[] = [];
  if (!facts.closureMethod) missing.push('closure method');
  if (stapleEvidence(facts)) {
    if (!facts.closureCount) missing.push('staple count');
    return missing;
  }
  if (!facts.closureMaterial) missing.push('suture material');
  if (!facts.closureCount) missing.push('suture count');
  return missing;
}

interface EntryResolution {
  repairClass: LacerationRepairClass | undefined;
  basis: RepairBasis | undefined;
  totals: WoundTotals;
  complexFloorAdvisory?: Finding;
}

function complexFallbackClass(
  facts: LacerationFacts
): { repairClass: LacerationRepairClass; basis: RepairBasis } | undefined {
  if (facts.structuredRepairDepth !== undefined) {
    return { repairClass: 'intermediate', basis: 'structured-layered' };
  }
  if (facts.depth?.value === 'layered') {
    return { repairClass: 'intermediate', basis: 'layered' };
  }
  return undefined;
}

function resolveEntry(
  facts: LacerationFacts,
  classResolution: RepairClassResolution,
  entrySite: AnatomicSite | undefined
): EntryResolution {
  let repairClass = resolvedClassOf(classResolution);
  let basis = resolvedBasisOf(classResolution);
  let totals = computeWoundTotals(facts, repairClass, entrySite);
  let complexFloorAdvisory: Finding | undefined;
  if (
    repairClass === 'complex' &&
    totals.totalCm !== undefined &&
    totals.totalCm < COMPLEX_REPAIR_MIN_CM - LENGTH_COMPARISON_EPSILON_CM
  ) {
    complexFloorAdvisory = {
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: `The note documents a complex-repair element (${complexElementList(
        facts
      )}), but complex repair codes start at ${formatCm(COMPLEX_REPAIR_MIN_CM)} cm — a ${formatCm(
        totals.totalCm
      )} cm wound is coded as a simple or intermediate repair by its closure depth.`,
      evidence: resolutionEvidence(classResolution),
    };
    const fallback = complexFallbackClass(facts);
    repairClass = fallback?.repairClass;
    basis = fallback?.basis;
    totals = computeWoundTotals(facts, repairClass, entrySite);
  }
  return { repairClass, basis, totals, complexFloorAdvisory };
}

interface DeterminedRepair {
  repairClass: LacerationRepairClass;
  basis: RepairBasis | undefined;
  entrySite: AnatomicSite;
  totalCm: number;
}

function determinedRepair(entry: EntryResolution, entrySite: AnatomicSite | undefined): DeterminedRepair | undefined {
  if (entry.repairClass === undefined || entrySite === undefined || entry.totals.totalCm === undefined) {
    return undefined;
  }
  return { repairClass: entry.repairClass, basis: entry.basis, entrySite, totalCm: entry.totals.totalCm };
}

function suggestLacerationCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLacerationFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  const classResolution = resolveRepairClass(facts);
  if (classResolution.kind === RepairClassOutcome.OutsideScope) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: OUTSIDE_SCOPE_MESSAGE,
      evidence: citing(classResolution),
    });
    evaluation.outcome = notAssessedCode(OUTSIDE_SCOPE_MESSAGE);
    return evaluation;
  }

  pushUnique(findings, repairDepthMismatchFinding(facts));
  pushUnique(findings, siteMismatchFinding(facts));

  if (facts.structuredRepairDepth === 'strips-only') {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.`,
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    });
    return evaluation;
  }

  if (facts.structuredRepairDepth === undefined && adhesiveStripsOnly(facts)) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message:
        'The note documents wound closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.',
      evidence: citing(facts.adhesiveStripsDocumented),
    });
    return evaluation;
  }

  const entrySite = facts.site?.value;
  const entry = resolveEntry(facts, classResolution, entrySite);
  pushUnique(findings, entry.totals.lengthIssueFinding);
  pushUnique(findings, entry.totals.mismatchFinding);
  pushUnique(findings, entry.complexFloorAdvisory);
  pushUnique(findings, duplicateLengthAdvisory(facts));
  for (const advisory of otherGroupAdvisories(entry.totals.otherGroupWounds, entry.repairClass)) {
    pushUnique(findings, advisory);
  }

  const missingDeterminants: Finding[] = [];
  if (entrySite === undefined) {
    missingDeterminants.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Body site is not documented — which repair codes apply depends on where on the body the wound is. ${whereClause(
        'site',
        'Select it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }
  if (entry.repairClass === undefined) {
    missingDeterminants.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Repair depth is not documented — a single-layer closure codes as a simple repair and a layered closure as an intermediate repair. ${whereClause(
        'depth',
        'Select it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }
  if (entry.totals.totalCm === undefined && entry.totals.lengthIssueFinding === undefined) {
    missingDeterminants.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Wound length is not documented — the exact code depends on the total repaired length in cm. ${whereClause(
        'length',
        'Enter it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }

  const determined = determinedRepair(entry, entrySite);
  if (determined === undefined) {
    findings.push(...missingDeterminants);
    const candidates = candidatesFor(entry.repairClass, entrySite);
    evaluation.outcome = openCodeSet(candidates, openSetSummary(candidates, entry, entrySite));
    return evaluation;
  }

  if (determined.repairClass === 'complex') {
    evaluation.outcome = determinedCode(complexSuggestion(facts, determined.entrySite, determined.totalCm));
    return evaluation;
  }

  const series = SERIES_BY_GROUP[lacerationSiteGroup(determined.repairClass, determined.entrySite)];
  const band = bandForLength(series, determined.totalCm);
  const suggestion: CodeSuggestion = {
    code: band.code,
    display: codeCandidate(series, band).display,
    justification: `${series.classLabel} repair — ${classBasisDescription(determined.basis)}; ${
      SITE_LABELS[determined.entrySite]
    } (${series.groupLabel}); total ${formatCm(determined.totalCm)} cm → ${band.code}.`,
  };
  if (determined.basis === 'adhesive' || determined.basis === 'structured-adhesive') {
    evaluation.payerNotes = [LACERATION_TISSUE_ADHESIVE_PAYER_NOTE];
    evaluation.outcome = determinedCodeWithAlternates(
      suggestion,
      [G0168_CANDIDATE],
      `G0168 is the Medicare professional-claim alternative for tissue-adhesive-only closure; OPPS facilities use ${band.code}, and commercial-payer handling varies`
    );
    return evaluation;
  }
  evaluation.outcome = determinedCode(suggestion);
  if (determined.basis === 'contaminated') {
    evaluation.payerNotes = [LACERATION_CONTAMINATION_PAYER_NOTE];
  }
  return evaluation;
}

function complexSuggestion(facts: LacerationFacts, entrySite: AnatomicSite, totalCm: number): CodeSuggestion {
  const series = COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)];
  const elements = complexElementList(facts);
  const siteClause = `${SITE_LABELS[entrySite]} (${series.groupLabel})`;
  if (totalCm <= COMPLEX_SECOND_MAX_CM + LENGTH_COMPARISON_EPSILON_CM) {
    const role: ComplexCodeRole = totalCm <= COMPLEX_BASE_MAX_CM + LENGTH_COMPARISON_EPSILON_CM ? 'base' : 'second';
    const code = complexCodeForRole(series, role);
    return {
      code,
      display: complexCodeCandidate(series, role).display,
      justification: `Complex repair — ${elements} documented; ${siteClause}; total ${formatCm(totalCm)} cm → ${code}.`,
    };
  }
  const units = complexAddOnUnits(totalCm);
  return {
    code: series.secondCode,
    display: `${series.secondCode} — Complex repair, ${series.groupLabel}, ${formatCm(totalCm)} cm total (with add-on ${
      series.addOnCode
    } × ${units} for the length beyond ${COMPLEX_SECOND_MAX_CM} cm)`,
    justification: `Complex repair — ${elements} documented; ${siteClause}; total ${formatCm(totalCm)} cm → ${
      series.secondCode
    } + ${series.addOnCode} × ${units} (${series.secondCode} covers the first ${COMPLEX_SECOND_MAX_CM} cm; ${
      series.addOnCode
    } each additional 5 cm or part).`,
    addOns: [
      {
        code: series.addOnCode,
        units,
        display: complexCodeCandidate(series, 'addOn').display,
        justification: `${formatCm(
          totalCm - COMPLEX_SECOND_MAX_CM
        )} cm beyond the first ${COMPLEX_SECOND_MAX_CM} cm → ${series.addOnCode} × ${units}.`,
      },
    ],
  };
}

const DOCUMENTED_CLASS_DESCRIPTIONS: Record<RepairBasis, (facts: LacerationFacts) => string> = {
  layered: () => 'a layered closure (an intermediate repair)',
  'structured-layered': () => 'a layered closure (an intermediate repair)',
  contaminated: () =>
    'a heavily contaminated wound with extensive cleaning (which qualifies as an intermediate repair)',
  'complex-element': (facts) =>
    `a complex-repair qualifying element (${complexElementList(facts)}), which supports a complex repair`,
  adhesive: () => 'closure with tissue adhesive alone (a simple repair)',
  'structured-adhesive': () => 'closure with tissue adhesive alone (a simple repair)',
  'structured-strips': () => 'closure with adhesive strips only (a simple repair)',
  'structured-single': () => 'a single-layer closure (a simple repair)',
  'single-layer': () => 'a single-layer superficial closure (a simple repair)',
};

function documentedClassClause(
  facts: LacerationFacts,
  classResolution: RepairClassResolution
): { documentedIn: string; description: string } {
  const basis = resolvedBasisOf(classResolution);
  const documentedIn =
    basis !== undefined && STRUCTURED_BASES.includes(basis) ? `the ${REPAIR_DEPTH_FIELD_LABEL} field` : 'the note';
  const description = DOCUMENTED_CLASS_DESCRIPTIONS[basis ?? 'single-layer'](facts);
  return { documentedIn, description };
}

function documentedLengthIn(totals: WoundTotals): string {
  const evidence = totals.totalEvidence;
  return evidence?.source === EvidenceSource.Field ? `the ${evidence.field} field` : 'the note';
}

function repairClassArticle(repairClass: LacerationRepairClass): string {
  return repairClass === 'simple' ? 'a simple' : repairClass === 'intermediate' ? 'an intermediate' : 'a complex';
}

function complexCodeFindings(
  code: string,
  indexed: IndexedComplexCode,
  facts: LacerationFacts,
  classResolution: RepairClassResolution,
  entrySite: AnatomicSite | undefined,
  selected: { code: string }[],
  entryFindings: Finding[]
): Finding[] {
  const codeFindings: Finding[] = [];
  const { series, role } = indexed;
  const resolvedClass = resolvedClassOf(classResolution);
  const hasElement = facts.complexElements.length > 0;

  if (resolvedClass === 'simple') {
    const { documentedIn, description } = documentedClassClause(facts, classResolution);
    codeFindings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `${code} is a complex-repair code, but ${documentedIn} documents ${description}.`,
      evidence: resolutionEvidence(classResolution),
    });
  } else if (!hasElement) {
    const elementAsk = whereClause(
      'complexElement',
      ifPerformedClause('performed', 'add the qualifying element', 'it')
    );
    if (resolvedClass === 'intermediate') {
      const { documentedIn } = documentedClassClause(facts, classResolution);
      const closureDescription =
        resolvedBasisOf(classResolution) === 'contaminated'
          ? 'a heavily contaminated wound with extensive cleaning'
          : 'a layered closure';
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is selected, but ${documentedIn} documents ${closureDescription} without any complex-repair element (${COMPLEX_ELEMENT_MENU}) — as documented this supports ${intermediateEquivalentRef(
          facts,
          entrySite
        )}. ${elementAsk}`,
        evidence: resolutionEvidence(classResolution),
      });
    } else {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is selected, but the note does not document any complex-repair element (${COMPLEX_ELEMENT_MENU}) — a complex repair needs at least one. ${elementAsk}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  if (entrySite === undefined) {
    codeFindings.push({
      level: 'determines',
      scope: codeScope(code),
      message: `Body site is not documented for ${code} — which repair codes apply depends on where on the body the wound is. ${whereClause(
        'site',
        'Select it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  } else if (complexRepairSiteGroup(entrySite) !== series.group) {
    codeFindings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `${code} covers ${series.groupLabel}, but the note documents ${withArticle(
        SITE_LABELS[entrySite]
      )} wound.`,
      evidence: citing(facts.site),
    });
  } else {
    const totals = computeWoundTotals(facts, 'complex', entrySite);
    pushUnique(entryFindings, totals.lengthIssueFinding);
    pushUnique(entryFindings, totals.mismatchFinding);
    if (totals.totalCm === undefined) {
      codeFindings.push({
        level: 'determines',
        scope: codeScope(code),
        message: `Wound length is not documented for ${code} — the exact code depends on the total repaired length; ${code} covers ${complexBandLabel(
          role
        )}. ${whereClause('length', 'Enter it')}`,
        evidence: NOTHING_TO_CITE,
      });
    } else if (totals.totalCm < COMPLEX_REPAIR_MIN_CM - LENGTH_COMPARISON_EPSILON_CM) {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is a complex-repair code — complex repairs are reported starting at ${formatCm(
          COMPLEX_REPAIR_MIN_CM
        )} cm, but ${documentedLengthIn(totals)} documents a total repaired length of ${formatCm(
          totals.totalCm
        )} cm; a wound that size is coded as a simple or intermediate repair.`,
        evidence: totals.totalEvidence ?? NOTHING_TO_CITE,
      });
    } else {
      const bandMismatch =
        role === 'base'
          ? totals.totalCm > COMPLEX_BASE_MAX_CM + LENGTH_COMPARISON_EPSILON_CM
          : role === 'second'
          ? totals.totalCm <= COMPLEX_BASE_MAX_CM + LENGTH_COMPARISON_EPSILON_CM
          : totals.totalCm <= COMPLEX_SECOND_MAX_CM + LENGTH_COMPARISON_EPSILON_CM;
      if (bandMismatch) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers ${complexBandLabel(role)} for ${series.groupLabel}, but ${documentedLengthIn(
            totals
          )} documents a total repaired length of ${formatCm(totals.totalCm)} cm.`,
          evidence: totals.totalEvidence ?? NOTHING_TO_CITE,
        });
      }
    }
  }

  if (role === 'addOn' && !selected.some((c) => c.code === series.secondCode)) {
    const foreignPrimary = selected.find((c) => {
      const other = COMPLEX_CODE_INDEX[c.code];
      return other !== undefined && other.role !== 'addOn' && other.series.group !== series.group;
    });
    if (foreignPrimary) {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is the add-on for complex repairs of ${series.groupLabel} (${series.baseCode}/${
          series.secondCode
        }), but the selected complex-repair code ${foreignPrimary.code} covers ${
          COMPLEX_CODE_INDEX[foreignPrimary.code].series.groupLabel
        } — an add-on must come from the same site group as its primary code.`,
        evidence: NOTHING_TO_CITE,
      });
    } else {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is an add-on code for each additional ${COMPLEX_ADD_ON_INCREMENT_CM} cm beyond ${COMPLEX_SECOND_MAX_CM} cm — it is billed alongside ${series.secondCode} (complex repair, ${series.groupLabel}, ${COMPLEX_SECOND_MIN_CM}–${COMPLEX_SECOND_MAX_CM} cm), but ${series.secondCode} is not selected.`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return codeFindings;
}

function intermediateEquivalentRef(facts: LacerationFacts, entrySite: AnatomicSite | undefined): string {
  if (entrySite === undefined) return 'an intermediate repair';
  const series = SERIES_BY_GROUP[lacerationSiteGroup('intermediate', entrySite)];
  const totals = computeWoundTotals(facts, 'intermediate', entrySite);
  if (totals.totalCm === undefined) {
    return `an intermediate repair (${series.bands[0].code}–${series.bands[series.bands.length - 1].code})`;
  }
  return `an intermediate repair (${bandForLength(series, totals.totalCm).code})`;
}

function defendLacerationCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLacerationFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const classResolution = resolveRepairClass(facts);
  if (classResolution.kind === RepairClassOutcome.OutsideScope) {
    selected.forEach((selectedCode) =>
      setCodeAssessment(evaluation, selectedCode.code, CodeAssessmentKind.NotAssessed)
    );
    evaluation.outcome = notAssessedCode(OUTSIDE_SCOPE_MESSAGE);
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: OUTSIDE_SCOPE_MESSAGE,
      evidence: citing(classResolution),
    });
    return evaluation;
  }

  pushUnique(findings, repairDepthMismatchFinding(facts));
  pushUnique(findings, siteMismatchFinding(facts));

  const stripsSelected = facts.structuredRepairDepth === 'strips-only';
  const stripsOnly = stripsSelected || (facts.structuredRepairDepth === undefined && adhesiveStripsOnly(facts));
  const entrySite = facts.site?.value;
  const inScopeSelected = selected.filter(
    (c) => isLacerationRepairCode(c.code) || COMPLEX_CODE_INDEX[c.code] !== undefined
  );
  const entry = resolveEntry(facts, classResolution, entrySite);
  if (inScopeSelected.length > 0) {
    pushUnique(findings, entry.totals.lengthIssueFinding);
    pushUnique(findings, entry.totals.mismatchFinding);
  }

  defendSelectedCodes(
    input,
    evaluation,
    (code) => {
      const indexed = LACERATION_CODE_INDEX[code];
      const complexIndexed = COMPLEX_CODE_INDEX[code];
      return indexed || complexIndexed ? { indexed, complexIndexed } : undefined;
    },
    ({ indexed, complexIndexed }, code, codeFindings) => {
      if (stripsOnly) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} is selected, but ${
            stripsSelected ? `the ${REPAIR_DEPTH_FIELD_LABEL} field` : 'the note'
          } documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code.`,
          evidence: stripsSelected ? fieldEvidence(REPAIR_DEPTH_FIELD_LABEL) : citing(facts.adhesiveStripsDocumented),
        });
      }

      if (complexIndexed) {
        codeFindings.push(
          ...complexCodeFindings(code, complexIndexed, facts, classResolution, entrySite, selected, findings)
        );
      } else if (indexed) {
        const impliedClass = indexed.series.repairClass;
        const resolvedClass = resolvedClassOf(classResolution);

        if (resolvedClass !== undefined && resolvedClass !== impliedClass) {
          const { documentedIn, description } = documentedClassClause(facts, classResolution);
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} is ${repairClassArticle(
              impliedClass
            )}-repair code, but ${documentedIn} documents ${description}.`,
            evidence: resolutionEvidence(classResolution),
          });
        } else if (resolvedClass === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `Repair depth is not documented for ${code} — a single-layer closure codes as a simple repair and a layered closure as an intermediate repair. ${whereClause(
              'depth',
              'Select it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });

          if (impliedClass === 'intermediate' && facts.contaminationDocumented && !facts.extensiveCleaningDocumented) {
            codeFindings.push({
              level: 'required',
              scope: codeScope(code),
              message: `The note documents heavy contamination but not the extensive cleaning/irrigation — ${code} as an intermediate repair on that basis needs both documented. ${whereClause(
                'extensiveCleaning'
              )}`,
              evidence: citing(facts.contaminationDocumented),
            });
          }
        }

        if (entrySite === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `Body site is not documented for ${code} — which repair codes apply depends on where on the body the wound is. ${whereClause(
              'site',
              'Select it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        } else {
          const entryGroup = lacerationSiteGroup(impliedClass, entrySite);
          if (entryGroup !== indexed.series.group) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} covers ${indexed.series.groupLabel}, but the note documents ${withArticle(
                SITE_LABELS[entrySite]
              )} wound.`,
              evidence: citing(facts.site),
            });
          } else {
            const totals = computeWoundTotals(facts, impliedClass, entrySite);
            pushUnique(findings, totals.lengthIssueFinding);
            pushUnique(findings, totals.mismatchFinding);
            if (totals.totalCm === undefined) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `Wound length is not documented for ${code} — the exact code depends on the total repaired length; ${code} covers ${bandLabel(
                  indexed.band
                )}. ${whereClause('length', 'Enter it')}`,
                evidence: NOTHING_TO_CITE,
              });
            } else if (!lengthFitsBand(indexed, totals.totalCm)) {
              codeFindings.push({
                level: 'contradiction',
                scope: codeScope(code),
                message: `${code} covers ${bandLabel(indexed.band)} for ${
                  indexed.series.groupLabel
                }, but ${documentedLengthIn(totals)} documents a total repaired length of ${formatCm(
                  totals.totalCm
                )} cm.`,
                evidence: totals.totalEvidence ?? NOTHING_TO_CITE,
              });
            }
          }
        }
      }

      if (!stripsOnly) {
        const missingClosure = missingClosureElements(facts);
        if (missingClosure.length > 0) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `Closure documentation for ${code} is incomplete — not documented: ${missingClosure.join(
              ', '
            )}. ${whereClause(
              stapleEvidence(facts) ? 'stapleClosure' : 'sutureClosure',
              missingClosure.length > 1 ? 'Add these' : 'Add it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }
    }
  );

  if (inScopeSelected.length > 0) {
    pushUnique(findings, duplicateLengthAdvisory(facts));
    for (const advisory of otherGroupAdvisories(entry.totals.otherGroupWounds, entry.repairClass)) {
      pushUnique(findings, advisory);
    }
    if (!facts.lateralityDocumented && entrySite !== undefined && LATERALIZABLE_SITES.includes(entrySite)) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Laterality is not documented for this ${
          SITE_LABELS[entrySite]
        } wound — noting left or right avoids ambiguity, especially with multiple wounds. ${whereClause(
          'laterality',
          'Select it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Anesthesia is not noted — it does not affect the code (local anesthesia is included in the repair), but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (!facts.irrigationDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Wound irrigation is not documented. ${whereClause('irrigation')}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (!facts.tetanusDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Tetanus status is not documented. ${whereClause('tetanus')}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    const payerNotes: string[] = [];
    if (facts.structuredRepairDepth === 'tissue-adhesive-only' || tissueAdhesiveOnly(facts)) {
      payerNotes.push(LACERATION_TISSUE_ADHESIVE_PAYER_NOTE);
    }
    if (resolvedBasisOf(classResolution) === 'contaminated') {
      payerNotes.push(LACERATION_CONTAMINATION_PAYER_NOTE);
    }
    if (payerNotes.length > 0) evaluation.payerNotes = payerNotes;
  }

  if (findings.some((f) => f.level === 'contradiction' && f.scope.kind === FindingScopeKind.Entry)) {
    for (const [code, assessment] of evaluation.codeAssessments) {
      if (assessment.kind === CodeAssessmentKind.Supported) {
        setCodeAssessment(evaluation, code, CodeAssessmentKind.Unsupported);
      }
    }
  }

  return evaluation;
}

export const lacerationFamily: ProcedureFamilyModel = {
  id: 'laceration',
  displayName: 'Laceration Repair (Wound Closure)',
  structuredFieldsFor: () => [ProcedureStructuredField.Length, ProcedureStructuredField.RepairDepth],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('laceration', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isLacerationRepairCode(c.code) || isComplexRepairCode(c.code))
  ),
  suggestCode: suggestLacerationCode,
  defendCodes: defendLacerationCodes,
};
