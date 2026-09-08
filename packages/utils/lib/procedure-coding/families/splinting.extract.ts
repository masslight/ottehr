import {
  firstMatch,
  lateralityDocumented,
  snippetAround,
  suppliesContain,
  techniqueOrTextFlag,
  textFlag,
  textMention,
} from '../extract';
import {
  PERFORMER_FIELD_LABEL,
  POST_INSTRUCTIONS_FIELD_LABEL,
  SITE_FIELD_LABEL,
  SUPPLIES_FIELD_LABEL,
  TECHNIQUE_FIELD_LABEL,
} from '../family-support';
import { FactProvenance, FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';

export type SplintRegion = 'long-arm' | 'short-arm' | 'finger' | 'long-leg' | 'short-leg';

export type StrapSiteRegion =
  | 'chest'
  | 'shoulder'
  | 'elbow-wrist'
  | 'hand-finger'
  | 'hip'
  | 'knee'
  | 'toes'
  | 'ankle-foot';

export type StrappingRegion = StrapSiteRegion | 'unna-boot' | 'multi-layer-leg';

export interface SplintingFacts {
  splintDocumented?: FactValue<true>;
  strappingDocumented?: FactValue<true>;
  unnaBootDocumented?: FactValue<true>;
  multiLayerCompressionDocumented?: FactValue<true>;
  lowerLegDocumented?: FactValue<true>;
  splintRegion?: FactValue<SplintRegion>;
  staticDynamic?: FactValue<'static' | 'dynamic'>;
  strapRegion?: FactValue<StrapSiteRegion>;
  applicationDocumented?: FactValue<true>;
  preNeurovascularDocumented?: FactValue<true>;
  postNeurovascularDocumented?: FactValue<true>;
  neurovascularUncuedDocumented?: FactValue<true>;
  materialDocumented?: FactValue<true>;
  instructionsDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

const SPLINT_PATTERN = /\bsplint(?!er)\w*/i;
const STRAPPING_PATTERN = /\bstrapp?(?:ed|ing)\b|\btaping\b/i;
const UNNA_BOOT_PATTERN = /unna\s*boot/i;

const MULTI_LAYER_COMPRESSION_PATTERN =
  /multi-?\s?layer(?:ed)?\s+compression|compression\s+system|\bprofore\b|\bcoban\s*2\b/i;

const LOWER_LEG_PATTERN =
  /\blower\s+(?:leg|extremit\w*)\b|below[-\s]?(?:the\s+)?knee|\bcalf\b|\bshin\b|\bgaiter\b|\bankles?\b|\bfoot\b|\bfeet\b|\blegs?\b/i;

const STATIC_PATTERN = /\bstatic\b/i;
const DYNAMIC_PATTERN = /\bdynamic\b/i;

export const EXPLICIT_SPLINT_REGION_PATTERNS: Array<[SplintRegion, RegExp]> = [
  ['long-arm', /long[-\s]arm/i],
  ['short-arm', /short[-\s]arm|sugar[-\s]?tong|thumb[-\s]?spica|spica\s+splint/i],
  ['long-leg', /long[-\s]leg/i],
  ['short-leg', /short[-\s]leg/i],
  ['finger', /finger\s+splint|mallet\s+splint|stack\s+splint/i],
];

const SITE_SPLINT_REGION_PATTERNS: Array<[SplintRegion, RegExp]> = [
  ['finger', /\bfingers?\b|\bthumbs?\b/i],
  ['long-arm', /\belbow\b|\bhumerus\b|upper\s+arm|supracondylar/i],
  ['short-arm', /\bforearm\b|\bwrist\b|\bradius\b|\bulna\b|\bhands?\b|\barms?\b/i],
  ['long-leg', /\bknee\b|\bthigh\b|\bfemur\b/i],
  ['short-leg', /\bankle\b|\bcalf\b|\bshin\b|\bfibula\b|\bfoot\b|\bfeet\b|\bheel\b|\btoes?\b|\blegs?\b/i],
];

export const STRAP_REGION_PATTERNS: Array<[StrapSiteRegion, RegExp]> = [
  ['chest', /\bchest\b|\bthorax\b|\bribs?\b|\bsternum\b/i],
  ['shoulder', /\bshoulder\b|\bclavicle\b|\bAC\s+joint\b/i],
  ['elbow-wrist', /\belbow\b|\bwrists?\b/i],
  ['hand-finger', /\bhands?\b|\bfingers?\b|\bthumbs?\b/i],
  ['hip', /\bhip\b/i],
  ['knee', /\bknee\b/i],
  ['toes', /\btoes?\b/i],
  ['ankle-foot', /\bankle\b|\bfoot\b|\bfeet\b|\bheel\b/i],
];

const APPLICATION_BY_PATTERN =
  /(?:applied|molded|fitted)[^.;\n]{0,24}\bby\b|\bI\s+(?:applied|molded|fitted)\b|molded\s+and\s+applied/i;

const NEUROVASCULAR_PATTERN =
  /neuro-?vascular\w*|\bNVI\b|\bCSM\b|cap(?:illary)?\s+refill|\bpulses?\b|\bmotor\b|sensat\w*|\bsensory\b/i;

const PRE_CONTEXT_PATTERN =
  /\bpre\b|\bpre[-\s]?(?:application|splint\w*|procedure|reduction)|\bprior\s+to\b|\bbefore\b/i;

const POST_CONTEXT_PATTERN =
  /\bpost\b|\bpost[-\s]?(?:application|splint\w*|procedure|reduction)|\bafter\b|\bfollowing\b|\bre-?checked?\b|\bremain(?:s|ed)\b/i;

const MOLDED_MATERIAL_PATTERN =
  /fiberglass|fibreglass|ortho-?glass|plaster|thermoplastic|\bsam\s+splint\b|pre-?fab(?:ricated)?\b/i;

const FINGER_MATERIAL_PATTERN =
  /alumin[iu]?um|aluma-?foam|\bfoam\b|stack\s+splint|mallet\s+splint|buddy\s+tap\w*|\bcoban\b|\btape\b|thermoplastic|pre-?fab(?:ricated)?\b/i;

interface SplintMaterialRule {
  pattern: RegExp;
  accepted: string;
  example: string;
}

export const SPLINT_MATERIAL_BY_REGION: Record<SplintRegion, SplintMaterialRule> = {
  'long-arm': {
    pattern: MOLDED_MATERIAL_PATTERN,
    accepted: 'fiberglass, plaster, OrthoGlass, or a prefabricated splint',
    example: '"fiberglass"',
  },
  'short-arm': {
    pattern: MOLDED_MATERIAL_PATTERN,
    accepted: 'fiberglass, plaster, OrthoGlass, or a prefabricated splint',
    example: '"fiberglass"',
  },
  finger: {
    pattern: FINGER_MATERIAL_PATTERN,
    accepted: 'aluminium foam, a stack or mallet splint, or buddy taping',
    example: '"aluminium foam splint"',
  },
  'long-leg': {
    pattern: MOLDED_MATERIAL_PATTERN,
    accepted: 'fiberglass, plaster, OrthoGlass, or a prefabricated splint',
    example: '"plaster"',
  },
  'short-leg': {
    pattern: MOLDED_MATERIAL_PATTERN,
    accepted: 'fiberglass, plaster, OrthoGlass, or a prefabricated splint',
    example: '"fiberglass"',
  },
};

const ANY_SPLINT_MATERIAL_PATTERN = new RegExp(
  `${MOLDED_MATERIAL_PATTERN.source}|${FINGER_MATERIAL_PATTERN.source}`,
  'i'
);

const INSTRUCTIONS_PATTERN =
  /instruct\w*|splint\s+care|elevat(?:e|ed|ion)\b|return\s+precautions|keep\s+(?:it\s+)?dry/i;

interface PatternHaystack {
  text: string;
  cite: (snippet: string) => FactProvenance;
}

function quoting(text: string): PatternHaystack {
  return { text, cite: textEvidence };
}

function picked(text: string, field: string): PatternHaystack {
  return { text, cite: () => fieldEvidence(field) };
}

function firstPatternValue<T>(haystacks: PatternHaystack[], patterns: Array<[T, RegExp]>): FactValue<T> | undefined {
  for (const { text, cite } of haystacks) {
    for (const [value, pattern] of patterns) {
      const found = firstMatch(text, pattern);

      if (found) return { value, evidence: cite(snippetAround(text, found.index, found.match.length)) };
    }
  }

  return undefined;
}

function extractNeurovascularExams(text: string): {
  pre?: FactValue<true>;
  post?: FactValue<true>;
  uncued?: FactValue<true>;
} {
  const result: { pre?: FactValue<true>; post?: FactValue<true>; uncued?: FactValue<true> } = {};
  const regex = new RegExp(NEUROVASCULAR_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const window = text.slice(Math.max(0, match.index - 70), match.index + match[0].length + 45);
    const snippet = snippetAround(text, match.index, match[0].length);
    const cuedPre = PRE_CONTEXT_PATTERN.test(window);
    const cuedPost = POST_CONTEXT_PATTERN.test(window);

    if (result.pre === undefined && cuedPre) result.pre = { value: true, evidence: textEvidence(snippet) };

    if (result.post === undefined && cuedPost) result.post = { value: true, evidence: textEvidence(snippet) };

    if (result.uncued === undefined && !cuedPre && !cuedPost) {
      result.uncued = { value: true, evidence: textEvidence(snippet) };
    }
  }

  return result;
}

export function extractSplintingFacts(input: ProcedureFactsInput): SplintingFacts {
  const text = input.procedureDetails ?? '';
  const structuredSite = [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
  const siteHaystacks = [picked(structuredSite, SITE_FIELD_LABEL), quoting(text)];
  const typeHaystacks = [picked((input.technique ?? []).join(' '), TECHNIQUE_FIELD_LABEL), quoting(text)];
  const staticFound = techniqueOrTextFlag(input, text, STATIC_PATTERN);
  const dynamicFound = techniqueOrTextFlag(input, text, DYNAMIC_PATTERN);
  let staticDynamic: FactValue<'static' | 'dynamic'> | undefined;

  if (staticFound && !dynamicFound) {
    staticDynamic = { ...staticFound, value: 'static' };
  } else if (dynamicFound && !staticFound) {
    staticDynamic = { ...dynamicFound, value: 'dynamic' };
  }

  const clinicianFields = Boolean(input.performerType?.trim() || input.documentedBy?.trim());
  const neurovascular = extractNeurovascularExams(text);
  const instructionsStructured = (input.postInstructions ?? []).some((value) => value.trim().length > 0);

  const splintRegion =
    firstPatternValue(typeHaystacks, EXPLICIT_SPLINT_REGION_PATTERNS) ??
    firstPatternValue(siteHaystacks, SITE_SPLINT_REGION_PATTERNS);

  const materialPattern =
    splintRegion === undefined ? ANY_SPLINT_MATERIAL_PATTERN : SPLINT_MATERIAL_BY_REGION[splintRegion.value].pattern;

  const materialFromSupplies = suppliesContain(input, materialPattern);

  return {
    splintDocumented: techniqueOrTextFlag(input, text, SPLINT_PATTERN),
    strappingDocumented: techniqueOrTextFlag(input, text, STRAPPING_PATTERN),
    unnaBootDocumented:
      techniqueOrTextFlag(input, text, UNNA_BOOT_PATTERN) ??
      (suppliesContain(input, UNNA_BOOT_PATTERN)
        ? { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) }
        : undefined),
    multiLayerCompressionDocumented: techniqueOrTextFlag(input, text, MULTI_LAYER_COMPRESSION_PATTERN),
    lowerLegDocumented: firstPatternValue(siteHaystacks, [[true as const, LOWER_LEG_PATTERN]]),
    splintRegion,
    staticDynamic,
    strapRegion: firstPatternValue(siteHaystacks, STRAP_REGION_PATTERNS),
    applicationDocumented: clinicianFields
      ? { value: true, evidence: fieldEvidence(PERFORMER_FIELD_LABEL) }
      : textFlag(text, APPLICATION_BY_PATTERN),
    preNeurovascularDocumented: neurovascular.pre,
    postNeurovascularDocumented: neurovascular.post,
    neurovascularUncuedDocumented: neurovascular.uncued,
    materialDocumented: materialFromSupplies
      ? { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) }
      : textFlag(text, materialPattern),
    instructionsDocumented: instructionsStructured
      ? { value: true, evidence: fieldEvidence(POST_INSTRUCTIONS_FIELD_LABEL) }
      : textMention(text, INSTRUCTIONS_PATTERN),
    lateralityDocumented: lateralityDocumented(input, text),
  };
}
