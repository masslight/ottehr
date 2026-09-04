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
import { SITE_FIELD_LABEL, SUPPLIES_FIELD_LABEL } from '../family-support';
import {
  FactProvenance,
  FactValue,
  fieldEvidence,
  ProcedureFactsInput,
  RepairDepthSelection,
  textEvidence,
} from '../model.types';

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

    if (DISTANCE_CONTEXT_PATTERN.test(after)) continue;

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
