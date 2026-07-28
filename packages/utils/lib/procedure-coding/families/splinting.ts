import {
  firstMatch,
  lateralityDocumented,
  snippetAround,
  suppliesContain,
  techniqueOrTextFlag,
  textFlag,
  textMention,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFromInfo,
  defendSelectedCodes,
  DETAILS_FIELD_LABEL,
  joinWithOr,
  lateralityFinding,
  PERFORMER_FIELD_LABEL,
  POST_INSTRUCTIONS_FIELD_LABEL,
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
  FactProvenance,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  fieldEvidence,
  ifPerformedClause,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  textEvidence,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

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

interface SplintCodeInfo {
  kind: 'splint';
  region: SplintRegion;
  staticDynamic?: 'static' | 'dynamic';
  display: string;
}

interface StrappingCodeInfo {
  kind: 'strapping';
  region: StrappingRegion;
  display: string;
}

type SplintingCodeInfo = SplintCodeInfo | StrappingCodeInfo;

const SPLINTING_CODES = {
  longArmSplint: '29105',
  shortArmStaticSplint: '29125',
  shortArmDynamicSplint: '29126',
  fingerStaticSplint: '29130',
  fingerDynamicSplint: '29131',
  longLegSplint: '29505',
  shortLegSplint: '29515',
  chestStrapping: '29200',
  shoulderStrapping: '29240',
  elbowWristStrapping: '29260',
  handFingerStrapping: '29280',
  hipStrapping: '29520',
  kneeStrapping: '29530',
  ankleFootStrapping: '29540',
  toeStrapping: '29550',
  unnaBoot: '29580',
  multiLayerCompression: '29581',
} as const;

type SplintingCode = (typeof SPLINTING_CODES)[keyof typeof SPLINTING_CODES];

const SPLINTING_CODE_INFO: Record<SplintingCode, SplintingCodeInfo> = {
  [SPLINTING_CODES.longArmSplint]: {
    kind: 'splint',
    region: 'long-arm',
    display: 'Application of long arm splint (shoulder to hand)',
  },
  [SPLINTING_CODES.shortArmStaticSplint]: {
    kind: 'splint',
    region: 'short-arm',
    staticDynamic: 'static',
    display: 'Application of short arm splint (forearm to hand); static',
  },
  [SPLINTING_CODES.shortArmDynamicSplint]: {
    kind: 'splint',
    region: 'short-arm',
    staticDynamic: 'dynamic',
    display: 'Application of short arm splint (forearm to hand); dynamic',
  },
  [SPLINTING_CODES.fingerStaticSplint]: {
    kind: 'splint',
    region: 'finger',
    staticDynamic: 'static',
    display: 'Application of finger splint; static',
  },
  [SPLINTING_CODES.fingerDynamicSplint]: {
    kind: 'splint',
    region: 'finger',
    staticDynamic: 'dynamic',
    display: 'Application of finger splint; dynamic',
  },
  [SPLINTING_CODES.longLegSplint]: {
    kind: 'splint',
    region: 'long-leg',
    display: 'Application of long leg splint (thigh to ankle or toes)',
  },
  [SPLINTING_CODES.shortLegSplint]: {
    kind: 'splint',
    region: 'short-leg',
    display: 'Application of short leg splint (calf to foot)',
  },
  [SPLINTING_CODES.chestStrapping]: { kind: 'strapping', region: 'chest', display: 'Strapping; thorax' },
  [SPLINTING_CODES.shoulderStrapping]: {
    kind: 'strapping',
    region: 'shoulder',
    display: 'Strapping; shoulder',
  },
  [SPLINTING_CODES.elbowWristStrapping]: {
    kind: 'strapping',
    region: 'elbow-wrist',
    display: 'Strapping; elbow or wrist',
  },
  [SPLINTING_CODES.handFingerStrapping]: {
    kind: 'strapping',
    region: 'hand-finger',
    display: 'Strapping; hand or finger',
  },
  [SPLINTING_CODES.hipStrapping]: { kind: 'strapping', region: 'hip', display: 'Strapping; hip' },
  [SPLINTING_CODES.kneeStrapping]: { kind: 'strapping', region: 'knee', display: 'Strapping; knee' },
  [SPLINTING_CODES.ankleFootStrapping]: {
    kind: 'strapping',
    region: 'ankle-foot',
    display: 'Strapping; ankle and/or foot',
  },
  [SPLINTING_CODES.toeStrapping]: { kind: 'strapping', region: 'toes', display: 'Strapping; toes' },
  [SPLINTING_CODES.unnaBoot]: { kind: 'strapping', region: 'unna-boot', display: 'Strapping; Unna boot' },
  [SPLINTING_CODES.multiLayerCompression]: {
    kind: 'strapping',
    region: 'multi-layer-leg',
    display: 'Application of multi-layer compression system; leg (below knee), including ankle and foot',
  },
};

export function isSplintingCode(code: string): code is SplintingCode {
  return code in SPLINTING_CODE_INFO;
}

const codeCandidate = codeCandidateFromInfo(SPLINTING_CODE_INFO);

const REGION_LABELS: Record<SplintRegion | StrappingRegion, string> = {
  'long-arm': 'the long-arm territory (elbow-to-shoulder involvement)',
  'short-arm': 'the short-arm territory (forearm/wrist)',
  finger: 'a finger',
  'long-leg': 'the long-leg territory (knee/thigh involvement)',
  'short-leg': 'the short-leg territory (calf to foot)',
  chest: 'the chest',
  shoulder: 'the shoulder',
  'elbow-wrist': 'the elbow or wrist',
  'hand-finger': 'the hand or finger',
  hip: 'the hip',
  knee: 'the knee',
  toes: 'the toes',
  'ankle-foot': 'the ankle/foot',
  'unna-boot': 'an Unna boot (leg below the knee)',
  'multi-layer-leg': 'a multi-layer compression system (leg below the knee)',
};

const SPLINT_REGION_MENU_LABELS: Record<SplintRegion, string> = {
  'long-arm': 'long arm',
  'short-arm': 'short arm',
  finger: 'finger',
  'long-leg': 'long leg',
  'short-leg': 'short leg',
};

const STRAP_REGION_MENU_LABELS: Record<StrapSiteRegion, string> = {
  chest: 'chest',
  shoulder: 'shoulder',
  'elbow-wrist': 'elbow or wrist',
  'hand-finger': 'hand or finger',
  hip: 'hip',
  knee: 'knee',
  toes: 'toes',
  'ankle-foot': 'ankle/foot',
};

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

const EXPLICIT_SPLINT_REGION_PATTERNS: Array<[SplintRegion, RegExp]> = [
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

const STRAP_REGION_PATTERNS: Array<[StrapSiteRegion, RegExp]> = [
  ['chest', /\bchest\b|\bthorax\b|\bribs?\b|\bsternum\b/i],
  ['shoulder', /\bshoulder\b|\bclavicle\b|\bAC\s+joint\b/i],
  ['elbow-wrist', /\belbow\b|\bwrists?\b/i],
  ['hand-finger', /\bhands?\b|\bfingers?\b|\bthumbs?\b/i],
  ['hip', /\bhip\b/i],
  ['knee', /\bknee\b/i],
  ['toes', /\btoes?\b/i],
  ['ankle-foot', /\bankle\b|\bfoot\b|\bfeet\b|\bheel\b/i],
];

const SPLINT_REGION_MENU = joinWithOr([
  ...new Set(
    Object.values(SPLINTING_CODE_INFO)
      .filter((info): info is SplintCodeInfo => info.kind === 'splint')
      .map((info) => SPLINT_REGION_MENU_LABELS[info.region])
  ),
]);
const STRAP_REGION_MENU = joinWithOr(STRAP_REGION_PATTERNS.map(([region]) => STRAP_REGION_MENU_LABELS[region]));

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

const SPLINT_MATERIAL_BY_REGION: Record<SplintRegion, SplintMaterialRule> = {
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

/**
 * One place a pattern is looked for, with the citation a match there earns. The two are carried
 * together because they are not independent: a match in the Site/location field cites that field,
 * and a match in the narrative cites the words around it — reading the same match as either kind of
 * evidence is what lets a picked value be reported as something the note says.
 */
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
      if (found) {
        return { value, evidence: cite(snippetAround(text, found.index, found.match.length)) };
      }
    }
  }
  return undefined;
}

/**
 * Pre- and post-application neurovascular exams: NV vocabulary classified by nearby pre/post
 * context. A third state is reported separately: an exam with no timing cue at all
 * ("Neurovascular exam intact distally") is documentation — it just is not tied to before or
 * after the application. Folding it into "absent" tells the provider they omitted two exams
 * they in fact performed, so the uncued match is kept as its own fact.
 */
function extractNeurovascularExams(text: string): {
  pre?: FactValue<true>;
  post?: FactValue<true>;
  uncued?: FactValue<true>;
} {
  const result: { pre?: FactValue<true>; post?: FactValue<true>; uncued?: FactValue<true> } = {};
  const regex = new RegExp(NEUROVASCULAR_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Window rather than sentence: template notes put "Pre-application:" on its own line above.
    const window = text.slice(Math.max(0, match.index - 70), match.index + match[0].length + 45);
    const snippet = snippetAround(text, match.index, match[0].length);
    const cuedPre = PRE_CONTEXT_PATTERN.test(window);
    const cuedPost = POST_CONTEXT_PATTERN.test(window);
    if (result.pre === undefined && cuedPre) {
      result.pre = { value: true, evidence: textEvidence(snippet) };
    }
    if (result.post === undefined && cuedPost) {
      result.post = { value: true, evidence: textEvidence(snippet) };
    }
    if (result.uncued === undefined && !cuedPre && !cuedPost) {
      result.uncued = { value: true, evidence: textEvidence(snippet) };
    }
  }
  return result;
}

/** Deterministic splinting/strapping fact extraction: structured fields first, then details-text patterns. */
export function extractSplintingFacts(input: ProcedureFactsInput): SplintingFacts {
  const text = input.procedureDetails ?? '';
  const structuredSite = [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
  const siteHaystacks = [picked(structuredSite, SITE_FIELD_LABEL), quoting(text)];
  // Explicit type language (in Technique or the text) beats site-derived regions.
  const typeHaystacks = [picked((input.technique ?? []).join(' '), TECHNIQUE_FIELD_LABEL), quoting(text)];

  const staticFound = techniqueOrTextFlag(input, text, STATIC_PATTERN);
  const dynamicFound = techniqueOrTextFlag(input, text, DYNAMIC_PATTERN);
  let staticDynamic: FactValue<'static' | 'dynamic'> | undefined;
  // Both documented is unresolvable — leave it an ask rather than guess.
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
  // The accepted material vocabulary follows the region, so the region is resolved first.
  const materialPattern =
    splintRegion === undefined ? ANY_SPLINT_MATERIAL_PATTERN : SPLINT_MATERIAL_BY_REGION[splintRegion.value].pattern;
  const materialFromSupplies = suppliesContain(input, materialPattern);

  return {
    splintDocumented: techniqueOrTextFlag(input, text, SPLINT_PATTERN),
    strappingDocumented: techniqueOrTextFlag(input, text, STRAPPING_PATTERN),
    // The Unna boot is a stocked supply as well as a technique, and picking it from Supplies used is
    // a positive statement that one was applied — the same standing the splint materials already
    // have below.
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

// ── Where each missing element belongs on the procedure form ───────────────────

const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  applianceKind: {
    destination: TO_DETAILS,
    example: '"short arm splint molded and applied" or "ankle strapping applied"',
  },
  splintType: {
    destination: `${TO_DETAILS} (or a Technique value)`,
    example: '"short arm volar splint" or "long leg posterior splint"',
  },
  staticDynamic: { destination: TO_DETAILS, example: '"static splint" or "dynamic (hinged) splint"' },
  strapSite: { destination: 'in the Site/location field, or name the strapped region in Procedure details' },
  laterality: { destination: 'in the Side of body field' },
  material: { destination: 'in the Supplies used field, or name it in Procedure details', example: '"fiberglass"' },
  application: {
    destination: `in the Performed by / Documented by fields, or state it in ${DETAILS_FIELD_LABEL}`,
    example: '"splint molded and applied by me"',
  },
  preNeurovascular: {
    destination: TO_DETAILS,
    example: '"pre-application: 2+ radial pulse, brisk cap refill, motor and sensation intact"',
  },
  postNeurovascular: {
    destination: TO_DETAILS,
    example: '"post-application: pulses, motor, and sensation intact; cap refill <2 s"',
  },
  neurovascularTiming: {
    destination: TO_DETAILS,
    example:
      '"pre-application: pulses 2+, sensation intact" and "post-application: pulses, motor, and sensation intact"',
  },
  instructions: {
    destination: `in the Post-procedure instructions field, or note them in ${DETAILS_FIELD_LABEL}`,
    example: '"splint care and elevation reviewed"',
  },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

const ALL_SPLINTING_CODES = Object.values(SPLINTING_CODES);
const SPLINT_CODES = ALL_SPLINTING_CODES.filter((code) => SPLINTING_CODE_INFO[code].kind === 'splint');
const STRAPPING_CODES = ALL_SPLINTING_CODES.filter((code) => SPLINTING_CODE_INFO[code].kind === 'strapping');
/** The two lower-leg compression codes: appliance-defined, so they share the same region check. */
const COMPRESSION_CODES = [SPLINTING_CODES.unnaBoot, SPLINTING_CODES.multiLayerCompression];

/** "29105–29515" for a code set, read off the code table so printed ranges cannot drift. */
function codeRange(codes: string[]): string {
  const sorted = [...codes].sort();
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}

const KIND_ASK_CLAUSE = `whether a splint or strapping was applied selects between the splint codes (${codeRange(
  SPLINT_CODES
)}) and the strapping codes (${codeRange(STRAPPING_CODES)})`;

/** Static/dynamic pair for a short-arm or finger splint region. */
function staticDynamicPair(region: 'short-arm' | 'finger'): { staticCode: SplintingCode; dynamicCode: SplintingCode } {
  return region === 'short-arm'
    ? {
        staticCode: SPLINTING_CODES.shortArmStaticSplint,
        dynamicCode: SPLINTING_CODES.shortArmDynamicSplint,
      }
    : { staticCode: SPLINTING_CODES.fingerStaticSplint, dynamicCode: SPLINTING_CODES.fingerDynamicSplint };
}

const SPLINT_CODE_BY_REGION: Record<Exclude<SplintRegion, 'short-arm' | 'finger'>, SplintingCode> = {
  'long-arm': SPLINTING_CODES.longArmSplint,
  'long-leg': SPLINTING_CODES.longLegSplint,
  'short-leg': SPLINTING_CODES.shortLegSplint,
};

const STRAPPING_CODE_BY_REGION: Record<StrappingRegion, SplintingCode> = {
  chest: SPLINTING_CODES.chestStrapping,
  shoulder: SPLINTING_CODES.shoulderStrapping,
  'elbow-wrist': SPLINTING_CODES.elbowWristStrapping,
  'hand-finger': SPLINTING_CODES.handFingerStrapping,
  hip: SPLINTING_CODES.hipStrapping,
  knee: SPLINTING_CODES.kneeStrapping,
  'ankle-foot': SPLINTING_CODES.ankleFootStrapping,
  toes: SPLINTING_CODES.toeStrapping,
  'unna-boot': SPLINTING_CODES.unnaBoot,
  'multi-layer-leg': SPLINTING_CODES.multiLayerCompression,
};

/** How the appliance-defined compression codes are named in a message. */
const COMPRESSION_APPLIANCE_LABEL: Record<string, string> = {
  [SPLINTING_CODES.unnaBoot]: 'an Unna boot (zinc paste) dressing',
  [SPLINTING_CODES.multiLayerCompression]: 'a multi-layer compression system',
};

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestSplintingCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractSplintingFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  // The appliance-defined compression codes come first — the most specific documentation wins.
  // Both are defined over the leg below the knee, so the region is confirmed the same way the
  // site strapping regions are, rather than being taken for granted from the appliance word.
  const compressionCode = facts.unnaBootDocumented
    ? SPLINTING_CODES.unnaBoot
    : facts.multiLayerCompressionDocumented
    ? SPLINTING_CODES.multiLayerCompression
    : undefined;
  if (compressionCode !== undefined) {
    if (facts.lowerLegDocumented === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `${compressionCode} covers ${
          REGION_LABELS[SPLINTING_CODE_INFO[compressionCode].region]
        }, but the treated region is not documented. ${whereClause('strapSite', 'Select it')}`,
        evidence: NOTHING_TO_CITE,
      });
      evaluation.outcome = openCodeSet(
        COMPRESSION_CODES.map(codeCandidate),
        `${codeRange(COMPRESSION_CODES)} — the treated region (leg below the knee) confirms the compression code`
      );
      return evaluation;
    }
    evaluation.outcome = determinedCode({
      code: compressionCode,
      display: codeCandidate(compressionCode).display,
      justification: `${
        facts.unnaBootDocumented ? 'Unna boot' : 'Multi-layer compression system'
      } applied to the leg below the knee → ${compressionCode}.`,
    });
    return evaluation;
  }

  // A splint statement governs even when tape is also mentioned (splints are secured with tape).
  const kind = facts.splintDocumented ? 'splint' : facts.strappingDocumented ? 'strapping' : undefined;
  if (kind === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The appliance is not documented — ${KIND_ASK_CLAUSE}. ${whereClause('applianceKind', 'Describe it')}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      ALL_SPLINTING_CODES.map(codeCandidate),
      `${codeRange(
        ALL_SPLINTING_CODES
      )} — the appliance (splint vs strapping) and the body region determine the exact code`
    );
    return evaluation;
  }

  if (kind === 'strapping') {
    const strapRegion = facts.strapRegion;
    if (strapRegion === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `The strapped region is not documented — the strapping code depends on it (${STRAP_REGION_MENU}). ${whereClause(
          'strapSite',
          'Select it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
      evaluation.outcome = openCodeSet(
        STRAPPING_CODES.map(codeCandidate),
        `${codeRange(STRAPPING_CODES)} — the strapped region determines the exact code`
      );
      return evaluation;
    }
    const code = STRAPPING_CODE_BY_REGION[strapRegion.value];
    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification: `Strapping documented; ${REGION_LABELS[strapRegion.value]} is the documented region → ${code}.`,
    });
    return evaluation;
  }

  // Splint branch: region first, then static vs dynamic where the codes split on it.
  const region = facts.splintRegion;
  if (region === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The splinted region is not documented — the splint code depends on the body region and splint type (${SPLINT_REGION_MENU}). ${whereClause(
        'splintType',
        'Select the Body site and/or name the splint'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      SPLINT_CODES.map(codeCandidate),
      `${codeRange(SPLINT_CODES)} — the splinted region and splint type determine the exact code`
    );
    return evaluation;
  }

  if (region.value === 'short-arm' || region.value === 'finger') {
    const pair = staticDynamicPair(region.value);
    if (facts.staticDynamic === undefined) {
      // Static is never assumed: the note must say static (or dynamic) for the pair to resolve.
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `Whether the splint is static or dynamic is not documented — it selects ${
          pair.staticCode
        } (static) vs ${
          pair.dynamicCode
        } (dynamic), and a static splint should say so rather than be assumed. ${whereClause(
          'staticDynamic',
          'Add it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
      evaluation.outcome = openCodeSet(
        [codeCandidate(pair.staticCode), codeCandidate(pair.dynamicCode)],
        `${pair.staticCode}–${pair.dynamicCode} — static vs dynamic determines the exact code`
      );
      return evaluation;
    }
    const code = facts.staticDynamic.value === 'static' ? pair.staticCode : pair.dynamicCode;
    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification: `Splint applied to ${REGION_LABELS[region.value]}; ${
        facts.staticDynamic.value
      } splint documented → ${code}.`,
    });
    return evaluation;
  }

  const code = SPLINT_CODE_BY_REGION[region.value];
  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: `Splint applied to ${REGION_LABELS[region.value]} → ${code}.`,
  });
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendSplintingCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractSplintingFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  // The compression appliances (29580/29581) are strapping evidence in their own right.
  const strappingEvidence =
    facts.strappingDocumented ?? facts.unnaBootDocumented ?? facts.multiLayerCompressionDocumented;
  const documentedCompressionCode = facts.unnaBootDocumented
    ? SPLINTING_CODES.unnaBoot
    : facts.multiLayerCompressionDocumented
    ? SPLINTING_CODES.multiLayerCompression
    : undefined;
  const inScopeSelected = selected.filter((c) => isSplintingCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isSplintingCode(code) ? SPLINTING_CODE_INFO[code] : undefined),
    (info, code, codeFindings) => {
      // Splint vs strapping: only-the-other-documented actively contradicts the code.
      if (info.kind === 'splint' && !facts.splintDocumented && strappingEvidence) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} is a splint-application code, but the note documents strapping/taping only — strapping is reported with ${codeRange(
            STRAPPING_CODES
          )}. ${whereClause('applianceKind', ifPerformedClause('applied', 'describe it', 'a splint'))}`,
          evidence: citing(strappingEvidence),
        });
      }
      if (info.kind === 'strapping' && !strappingEvidence && facts.splintDocumented) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} is a strapping code, but the note documents a splint only — splint application is reported with ${codeRange(
            SPLINT_CODES
          )}. ${whereClause('applianceKind', ifPerformedClause('applied', 'describe it', 'strapping'))}`,
          evidence: citing(facts.splintDocumented),
        });
      }

      // Region: [C] on mismatch, [D] ask when undocumented.
      if (info.kind === 'splint') {
        const region = facts.splintRegion;
        if (region === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `The splinted region is not documented for ${code} — the splint code depends on the body region and splint type. ${whereClause(
              'splintType',
              'Select the Body site and/or name the splint'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        } else if (region.value !== info.region) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers a splint of ${REGION_LABELS[info.region]}, but the note documents ${
              REGION_LABELS[region.value]
            }.`,
            evidence: citing(region),
          });
        }
        // Static vs dynamic, both directions, for the code pairs that split on it.
        if (info.staticDynamic !== undefined) {
          if (facts.staticDynamic === undefined) {
            codeFindings.push({
              level: 'determines',
              scope: codeScope(code),
              message: `Whether the splint is static or dynamic is not documented for ${code} — it selects between the static and dynamic codes, and a static splint should say so rather than be assumed. ${whereClause(
                'staticDynamic',
                'Add it'
              )}`,
              evidence: NOTHING_TO_CITE,
            });
          } else if (facts.staticDynamic.value !== info.staticDynamic) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} is the ${info.staticDynamic} splint code, but the note documents a ${facts.staticDynamic.value} splint.`,
              evidence: citing(facts.staticDynamic),
            });
          }
        }
      } else if (COMPRESSION_CODES.some((compressionCode) => compressionCode === code)) {
        // 29580/29581 are appliance-defined: each needs its appliance named (a paste boot, a
        // multi-layer system), and — like every strapping region — the leg below the knee confirmed.
        const applianceFact =
          code === SPLINTING_CODES.unnaBoot ? facts.unnaBootDocumented : facts.multiLayerCompressionDocumented;
        if (applianceFact === undefined) {
          if (facts.strapRegion !== undefined) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} covers ${COMPRESSION_APPLIANCE_LABEL[code]}, but the note documents strapping of ${
                REGION_LABELS[facts.strapRegion.value]
              } without one — that strapping is reported with ${STRAPPING_CODE_BY_REGION[facts.strapRegion.value]}.`,
              evidence: citing(facts.strapRegion),
            });
          } else {
            codeFindings.push({
              level: 'determines',
              scope: codeScope(code),
              message: `${
                COMPRESSION_APPLIANCE_LABEL[code]
              } is not documented for ${code} — the code is defined by that appliance. ${whereClause(
                'applianceKind',
                ifPerformedClause('applied', 'name it')
              )}`,
              evidence: NOTHING_TO_CITE,
            });
          }
        } else if (facts.lowerLegDocumented === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `The treated region is not documented for ${code} — it covers ${
              REGION_LABELS[info.region]
            }. ${whereClause('strapSite', 'Select it')}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      } else {
        const strapRegion = facts.strapRegion;
        if (documentedCompressionCode !== undefined) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers strapping of ${REGION_LABELS[info.region]}, but the note documents ${
              COMPRESSION_APPLIANCE_LABEL[documentedCompressionCode]
            } — that is reported with ${documentedCompressionCode}.`,
            evidence: citing(facts.unnaBootDocumented ?? facts.multiLayerCompressionDocumented),
          });
        } else if (strapRegion === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `The strapped region is not documented for ${code} — the strapping code depends on it. ${whereClause(
              'strapSite',
              'Select it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        } else if (strapRegion.value !== info.region) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers strapping of ${REGION_LABELS[info.region]}, but the note documents ${
              REGION_LABELS[strapRegion.value]
            }.`,
            evidence: citing(strapRegion),
          });
        }
      }

      // [R] elements every application/strapping code needs.
      if (!facts.applicationDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Application by the clinician is not documented for ${code} — application codes require that the clinician applied (and for splints, molded) the appliance. ${whereClause(
            'application',
            'Record it'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      // The pre- and post-application exams stay separate requirements, but an exam documented
      // with no timing cue ("Neurovascular exam intact distally") is not an absent exam — it is a
      // missing label. Reporting that as two omitted exams accuses the provider of not examining
      // the limb, so the uncued case becomes one finding asking which check it was.
      const missingPre = facts.preNeurovascularDocumented === undefined;
      const missingPost = facts.postNeurovascularDocumented === undefined;
      const uncuedNeurovascular = facts.neurovascularUncuedDocumented;
      if (uncuedNeurovascular !== undefined && (missingPre || missingPost)) {
        const untied = missingPre && missingPost ? 'before or after' : missingPre ? 'before' : 'after';
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `A neurovascular exam is documented for ${code}, but it is not tied to ${untied} application — the pre- and post-application checks are separate elements. If both were performed, say which is which. ${whereClause(
            'neurovascularTiming',
            'Add the timing'
          )}`,
          evidence: citing(uncuedNeurovascular),
        });
      } else {
        if (missingPre) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `A pre-application neurovascular exam is not documented for ${code} — record pulses, motor, sensation, and cap refill before application. ${whereClause(
              'preNeurovascular'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
        if (missingPost) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `A post-application neurovascular exam is not documented for ${code} — re-examine and record pulses, motor, sensation, and cap refill after application. ${whereClause(
              'postNeurovascular'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }
      // Chest strapping (29200) is the one midline code without a side.
      if (!facts.lateralityDocumented && code !== SPLINTING_CODES.chestStrapping) {
        codeFindings.push(lateralityFinding(code, whereClause('laterality', 'Select it')));
      }
      // Material completes the splint note but does not determine or defend the application code.
      // It stays code-scoped because the useful reminder depends on the region — a finger splint
      // is not a casting job — while [B] keeps its absence from suppressing green support.
      if (info.kind === 'splint' && !facts.materialDocumented) {
        const material = SPLINT_MATERIAL_BY_REGION[info.region];
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The splint material is not documented for ${code} — it does not affect code selection, but a complete note records what the splint was made of (${
            material.accepted
          }). ${whereToDocumentClause({ ...WHERE_TO_DOCUMENT.material, example: material.example }, 'Record it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (inScopeSelected.length > 0 && !facts.instructionsDocumented) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: `Patient instructions are not documented — splint/strapping care and elevation guidance complete the note. ${whereClause(
        'instructions',
        'Record them'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

export const splintingFamily: ProcedureFamilyModel = {
  id: 'splinting',
  displayName: 'Splinting & Strapping',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('splinting', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isSplintingCode(c.code))
  ),
  suggestCode: suggestSplintingCode,
  defendCodes: defendSplintingCodes,
};
