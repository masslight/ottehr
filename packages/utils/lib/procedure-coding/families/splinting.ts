// Musculoskeletal splinting & strapping coding model — functional requirements §6.3.
// Splints: 29105 (long arm), 29125/29126 (short arm static/dynamic), 29130/29131 (finger
// static/dynamic), 29505 (long leg), 29515 (short leg). Strapping: 29200 (chest), 29240
// (shoulder), 29520 (hip), 29530 (knee), 29540 (ankle/foot), 29580 (Unna boot). The body
// region and the appliance (splint vs strapping, long vs short, static vs dynamic) together
// determine the code; other application codes (e.g. casts) are outside scope and are
// reported "not assessed", never guessed.

import { firstMatch, snippetAround, suppliesContain, textFlag, textMention } from '../extract';
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

// ── Regions and code table ─────────────────────────────────────────────────────

/** The region a splint code covers (long vs short is part of the region: it names the territory immobilized). */
export type SplintRegion = 'long-arm' | 'short-arm' | 'finger' | 'long-leg' | 'short-leg';
/** The region a strapping code covers ('unna-boot' is its own code, not a site). */
export type StrappingRegion = 'chest' | 'shoulder' | 'hip' | 'knee' | 'ankle-foot' | 'unna-boot';

interface SplintingCodeInfo {
  kind: 'splint' | 'strapping';
  region: SplintRegion | StrappingRegion;
  /** Static vs dynamic, only for the code pairs that split on it (29125/29126, 29130/29131). */
  staticDynamic?: 'static' | 'dynamic';
  display: string;
}

const SPLINTING_CODE_INFO: Record<string, SplintingCodeInfo> = {
  '29105': { kind: 'splint', region: 'long-arm', display: 'Application of long arm splint (shoulder to hand)' },
  '29125': {
    kind: 'splint',
    region: 'short-arm',
    staticDynamic: 'static',
    display: 'Application of short arm splint (forearm to hand); static',
  },
  '29126': {
    kind: 'splint',
    region: 'short-arm',
    staticDynamic: 'dynamic',
    display: 'Application of short arm splint (forearm to hand); dynamic',
  },
  '29130': {
    kind: 'splint',
    region: 'finger',
    staticDynamic: 'static',
    display: 'Application of finger splint; static',
  },
  '29131': {
    kind: 'splint',
    region: 'finger',
    staticDynamic: 'dynamic',
    display: 'Application of finger splint; dynamic',
  },
  '29505': { kind: 'splint', region: 'long-leg', display: 'Application of long leg splint (thigh to ankle or toes)' },
  '29515': { kind: 'splint', region: 'short-leg', display: 'Application of short leg splint (calf to foot)' },
  '29200': { kind: 'strapping', region: 'chest', display: 'Strapping; thorax' },
  '29240': { kind: 'strapping', region: 'shoulder', display: 'Strapping; shoulder' },
  '29520': { kind: 'strapping', region: 'hip', display: 'Strapping; hip' },
  '29530': { kind: 'strapping', region: 'knee', display: 'Strapping; knee' },
  '29540': { kind: 'strapping', region: 'ankle-foot', display: 'Strapping; ankle and/or foot' },
  '29580': { kind: 'strapping', region: 'unna-boot', display: 'Strapping; Unna boot' },
};

export function isSplintingCode(code: string): boolean {
  return SPLINTING_CODE_INFO[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${SPLINTING_CODE_INFO[code].display}` };
}

const REGION_LABELS: Record<SplintRegion | StrappingRegion, string> = {
  'long-arm': 'the long-arm territory (elbow-to-shoulder involvement)',
  'short-arm': 'the short-arm territory (forearm/wrist)',
  finger: 'a finger',
  'long-leg': 'the long-leg territory (knee/thigh involvement)',
  'short-leg': 'the short-leg territory (calf to foot)',
  chest: 'the chest',
  shoulder: 'the shoulder',
  hip: 'the hip',
  knee: 'the knee',
  'ankle-foot': 'the ankle/foot',
  'unna-boot': 'an Unna boot (lower leg)',
};

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface SplintingFacts {
  /** Splint-application language ("splint applied/molded"), from Technique values or the text. */
  splintDocumented?: FactValue<true>;
  /** Strapping/taping language, from Technique values or the text (an Unna boot also counts). */
  strappingDocumented?: FactValue<true>;
  unnaBootDocumented?: FactValue<true>;
  /** The splint region, from explicit type language ("short arm", "sugar-tong") or the documented site. */
  splintRegion?: FactValue<SplintRegion>;
  /** Static vs dynamic — only ever set when the text says so; never assumed. */
  staticDynamic?: FactValue<'static' | 'dynamic'>;
  /** The strapping site, from the structured body site or site words in the text. */
  strapRegion?: FactValue<Exclude<StrappingRegion, 'unna-boot'>>;
  /** Application by the clinician: the Performed by / Documented by fields, or "applied/molded by" text. */
  applicationDocumented?: FactValue<true>;
  /** Pre-application neurovascular exam (pulses/motor/sensation/cap refill with pre-application context). */
  preNeurovascularDocumented?: FactValue<true>;
  /** Post-application neurovascular exam — a separate element from the pre-application exam. */
  postNeurovascularDocumented?: FactValue<true>;
  /** Fiberglass or plaster, from Supplies used or the text. */
  materialDocumented?: FactValue<true>;
  /** Patient instructions (splint care, elevation), from Post-procedure instructions or the text. */
  instructionsDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

// "splint" language, guarded against "splinter" (foreign-body vocabulary).
const SPLINT_PATTERN = /\bsplint(?!er)\w*/i;
const STRAPPING_PATTERN = /\bstrapp?(?:ed|ing)\b|\btaping\b/i;
const UNNA_BOOT_PATTERN = /unna\s*boot/i;
const STATIC_PATTERN = /\bstatic\b/i;
const DYNAMIC_PATTERN = /\bdynamic\b/i;

// Explicit splint-type language names the region directly; a sugar-tong splint is in the
// short-arm family. Checked before site words so "long arm splint" wins over a "wrist" mention.
const EXPLICIT_SPLINT_REGION_PATTERNS: Array<[SplintRegion, RegExp]> = [
  ['long-arm', /long[-\s]arm/i],
  ['short-arm', /short[-\s]arm|sugar[-\s]?tong/i],
  ['long-leg', /long[-\s]leg/i],
  ['short-leg', /short[-\s]leg/i],
  ['finger', /finger\s+splint|mallet\s+splint|stack\s+splint/i],
];

// Site words → splint region. Order matters: finger first (a finger is also on the "arm"),
// then long-arm involvement (elbow to shoulder) before the generic arm/forearm/wrist words,
// and likewise for the leg (knee/thigh ⇒ long leg before the generic leg/ankle/foot words).
const SITE_SPLINT_REGION_PATTERNS: Array<[SplintRegion, RegExp]> = [
  ['finger', /\bfingers?\b|\bthumbs?\b/i],
  ['long-arm', /\belbow\b|\bhumerus\b|upper\s+arm|supracondylar/i],
  ['short-arm', /\bforearm\b|\bwrist\b|\bradius\b|\bulna\b|\bhands?\b|\barms?\b/i],
  ['long-leg', /\bknee\b|\bthigh\b|\bfemur\b/i],
  ['short-leg', /\bankle\b|\bcalf\b|\bshin\b|\bfibula\b|\bfoot\b|\bfeet\b|\bheel\b|\btoes?\b|\blegs?\b/i],
];

const STRAP_REGION_PATTERNS: Array<[Exclude<StrappingRegion, 'unna-boot'>, RegExp]> = [
  ['chest', /\bchest\b|\bthorax\b|\bribs?\b|\bsternum\b/i],
  ['shoulder', /\bshoulder\b|\bclavicle\b|\bAC\s+joint\b/i],
  ['hip', /\bhip\b/i],
  ['knee', /\bknee\b/i],
  ['ankle-foot', /\bankle\b|\bfoot\b|\bfeet\b|\bheel\b|\btoes?\b/i],
];

// "molded and applied by …", "I applied …" — the clinician-application statement.
const APPLICATION_BY_PATTERN =
  /(?:applied|molded|fitted)[^.;\n]{0,24}\bby\b|\bI\s+(?:applied|molded|fitted)\b|molded\s+and\s+applied/i;

// Neurovascular exam vocabulary; matched unguarded because "no neurovascular deficit" is
// valid exam documentation. Pre/post context is read from the surrounding window.
const NEUROVASCULAR_PATTERN =
  /neuro-?vascular\w*|\bNVI\b|\bCSM\b|cap(?:illary)?\s+refill|\bpulses?\b|\bmotor\b|sensat\w*|\bsensory\b/i;
const PRE_CONTEXT_PATTERN =
  /\bpre\b|\bpre[-\s]?(?:application|splint\w*|procedure|reduction)|\bprior\s+to\b|\bbefore\b/i;
const POST_CONTEXT_PATTERN =
  /\bpost\b|\bpost[-\s]?(?:application|splint\w*|procedure|reduction)|\bafter\b|\bfollowing\b|\bre-?checked?\b|\bremain(?:s|ed)\b/i;

const MATERIAL_PATTERN = /fiberglass|fibreglass|ortho-?glass|plaster/i;
const INSTRUCTIONS_PATTERN =
  /instruct\w*|splint\s+care|elevat(?:e|ed|ion)\b|return\s+precautions|keep\s+(?:it\s+)?dry/i;

/** A fact matched across the structured Technique values (structured) or the details text. */
function techniqueOrTextFlag(input: ProcedureFactsInput, text: string, pattern: RegExp): FactValue<true> | undefined {
  if ((input.technique ?? []).some((value) => pattern.test(value))) {
    return { value: true, confidence: 'structured' };
  }
  return textFlag(text, pattern);
}

function firstPatternValue<T>(
  haystacks: Array<{ text: string; confidence: 'structured' | 'text' }>,
  patterns: Array<[T, RegExp]>
): FactValue<T> | undefined {
  for (const { text, confidence } of haystacks) {
    for (const [value, pattern] of patterns) {
      const found = firstMatch(text, pattern);
      if (found) {
        return {
          value,
          confidence,
          sourceText: confidence === 'text' ? snippetAround(text, found.index, found.match.length) : undefined,
        };
      }
    }
  }
  return undefined;
}

/** Pre- and post-application neurovascular exams: NV vocabulary classified by nearby pre/post context. */
function extractNeurovascularExams(text: string): {
  pre?: FactValue<true>;
  post?: FactValue<true>;
} {
  const result: { pre?: FactValue<true>; post?: FactValue<true> } = {};
  const regex = new RegExp(NEUROVASCULAR_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Window rather than sentence: template notes put "Pre-application:" on its own line above.
    const window = text.slice(Math.max(0, match.index - 70), match.index + match[0].length + 45);
    const snippet = snippetAround(text, match.index, match[0].length);
    if (result.pre === undefined && PRE_CONTEXT_PATTERN.test(window)) {
      result.pre = { value: true, confidence: 'text', sourceText: snippet };
    }
    if (result.post === undefined && POST_CONTEXT_PATTERN.test(window)) {
      result.post = { value: true, confidence: 'text', sourceText: snippet };
    }
    if (result.pre && result.post) break;
  }
  return result;
}

/** Deterministic splinting/strapping fact extraction: structured fields first, then details-text patterns. */
export function extractSplintingFacts(input: ProcedureFactsInput): SplintingFacts {
  const text = input.procedureDetails ?? '';
  const structuredSite = [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
  const siteHaystacks: Array<{ text: string; confidence: 'structured' | 'text' }> = [
    { text: structuredSite, confidence: 'structured' },
    { text, confidence: 'text' },
  ];
  // Explicit type language (in Technique or the text) beats site-derived regions.
  const typeHaystacks: Array<{ text: string; confidence: 'structured' | 'text' }> = [
    { text: (input.technique ?? []).join(' '), confidence: 'structured' },
    { text, confidence: 'text' },
  ];

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
  const materialFromSupplies = suppliesContain(input, MATERIAL_PATTERN);
  const instructionsStructured = (input.postInstructions ?? []).some((value) => value.trim().length > 0);

  return {
    splintDocumented: techniqueOrTextFlag(input, text, SPLINT_PATTERN),
    strappingDocumented: techniqueOrTextFlag(input, text, STRAPPING_PATTERN),
    unnaBootDocumented: techniqueOrTextFlag(input, text, UNNA_BOOT_PATTERN),
    splintRegion:
      firstPatternValue(typeHaystacks, EXPLICIT_SPLINT_REGION_PATTERNS) ??
      firstPatternValue(siteHaystacks, SITE_SPLINT_REGION_PATTERNS),
    staticDynamic,
    strapRegion: firstPatternValue(siteHaystacks, STRAP_REGION_PATTERNS),
    applicationDocumented: clinicianFields
      ? { value: true, confidence: 'structured' }
      : textFlag(text, APPLICATION_BY_PATTERN),
    preNeurovascularDocumented: neurovascular.pre,
    postNeurovascularDocumented: neurovascular.post,
    materialDocumented: materialFromSupplies
      ? { value: true, confidence: 'structured' }
      : textFlag(text, MATERIAL_PATTERN),
    instructionsDocumented: instructionsStructured
      ? { value: true, confidence: 'structured' }
      : textMention(text, INSTRUCTIONS_PATTERN),
    lateralityDocumented: Boolean(input.bodySide),
  };
}

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

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
  instructions: {
    destination: `in the Post-procedure instructions field, or note them in ${DETAILS_FIELD_LABEL}`,
    example: '"splint care and elevation reviewed"',
  },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

const SPLINT_CODES = Object.keys(SPLINTING_CODE_INFO).filter((code) => SPLINTING_CODE_INFO[code].kind === 'splint');
const STRAPPING_CODES = Object.keys(SPLINTING_CODE_INFO).filter(
  (code) => SPLINTING_CODE_INFO[code].kind === 'strapping'
);

const KIND_ASK_CLAUSE =
  'whether a splint or strapping was applied selects between the splint codes (29105–29515) and the strapping codes (29200–29580)';

/** Static/dynamic pair for a short-arm or finger splint region. */
function staticDynamicPair(region: 'short-arm' | 'finger'): { staticCode: string; dynamicCode: string } {
  return region === 'short-arm'
    ? { staticCode: '29125', dynamicCode: '29126' }
    : { staticCode: '29130', dynamicCode: '29131' };
}

const SPLINT_CODE_BY_REGION: Record<Exclude<SplintRegion, 'short-arm' | 'finger'>, string> = {
  'long-arm': '29105',
  'long-leg': '29505',
  'short-leg': '29515',
};

const STRAPPING_CODE_BY_REGION: Record<StrappingRegion, string> = {
  chest: '29200',
  shoulder: '29240',
  hip: '29520',
  knee: '29530',
  'ankle-foot': '29540',
  'unna-boot': '29580',
};

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestSplintingCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractSplintingFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings } = evaluation;

  // An Unna boot is its own strapping code — the most specific documentation wins.
  if (facts.unnaBootDocumented) {
    evaluation.suggestion = {
      code: '29580',
      display: codeCandidate('29580').display,
      justification: 'Unna boot application documented → 29580.',
    };
    return evaluation;
  }

  // A splint statement governs even when tape is also mentioned (splints are secured with tape).
  const kind = facts.splintDocumented ? 'splint' : facts.strappingDocumented ? 'strapping' : undefined;
  if (kind === undefined) {
    findings.push({
      level: 'determines',
      message: `The appliance is not documented — ${KIND_ASK_CLAUSE}. ${whereClause('applianceKind', 'Describe it')}`,
    });
    evaluation.openCandidates = Object.keys(SPLINTING_CODE_INFO).map(codeCandidate);
    return evaluation;
  }

  if (kind === 'strapping') {
    const strapRegion = facts.strapRegion;
    if (strapRegion === undefined) {
      findings.push({
        level: 'determines',
        message: `The strapped region is not documented — the strapping code depends on it (chest, shoulder, hip, knee, or ankle/foot). ${whereClause(
          'strapSite',
          'Select it'
        )}`,
      });
      evaluation.openCandidates = STRAPPING_CODES.map(codeCandidate);
      return evaluation;
    }
    const code = STRAPPING_CODE_BY_REGION[strapRegion.value];
    evaluation.suggestion = {
      code,
      display: codeCandidate(code).display,
      justification: `Strapping documented; ${REGION_LABELS[strapRegion.value]} is the documented region → ${code}.`,
    };
    return evaluation;
  }

  // Splint branch: region first, then static vs dynamic where the codes split on it.
  const region = facts.splintRegion;
  if (region === undefined) {
    findings.push({
      level: 'determines',
      message: `The splinted region is not documented — the splint code depends on the body region and splint type (long arm, short arm, finger, long leg, or short leg). ${whereClause(
        'splintType',
        'Select the Body site and/or name the splint'
      )}`,
    });
    evaluation.openCandidates = SPLINT_CODES.map(codeCandidate);
    return evaluation;
  }

  if (region.value === 'short-arm' || region.value === 'finger') {
    const pair = staticDynamicPair(region.value);
    if (facts.staticDynamic === undefined) {
      // Static is never assumed: the note must say static (or dynamic) for the pair to resolve.
      findings.push({
        level: 'determines',
        message: `Whether the splint is static or dynamic is not documented — it selects ${
          pair.staticCode
        } (static) vs ${
          pair.dynamicCode
        } (dynamic), and a static splint should say so rather than be assumed. ${whereClause(
          'staticDynamic',
          'Add it'
        )}`,
      });
      evaluation.openCandidates = [codeCandidate(pair.staticCode), codeCandidate(pair.dynamicCode)];
      return evaluation;
    }
    const code = facts.staticDynamic.value === 'static' ? pair.staticCode : pair.dynamicCode;
    evaluation.suggestion = {
      code,
      display: codeCandidate(code).display,
      justification: `Splint applied to ${REGION_LABELS[region.value]}; ${
        facts.staticDynamic.value
      } splint documented → ${code}.`,
    };
    return evaluation;
  }

  const code = SPLINT_CODE_BY_REGION[region.value];
  evaluation.suggestion = {
    code,
    display: codeCandidate(code).display,
    justification: `Splint applied to ${REGION_LABELS[region.value]} → ${code}.`,
  };
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendSplintingCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractSplintingFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const strappingEvidence = facts.strappingDocumented ?? facts.unnaBootDocumented;
  const inScopeSelected = selected.filter((c) => isSplintingCode(c.code));

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    const info = SPLINTING_CODE_INFO[code];
    if (info === undefined) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // Splint vs strapping: only-the-other-documented actively contradicts the code.
    if (info.kind === 'splint' && !facts.splintDocumented && strappingEvidence) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is a splint-application code, but the note documents strapping/taping only — strapping is reported with 29200–29580. ${whereClause(
          'applianceKind',
          'If a splint was applied, describe it'
        )}`,
        sourceText: strappingEvidence.sourceText,
        confidence: strappingEvidence.confidence,
      });
    }
    if (info.kind === 'strapping' && !strappingEvidence && facts.splintDocumented) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is a strapping code, but the note documents a splint only — splint application is reported with 29105–29515. ${whereClause(
          'applianceKind',
          'If strapping was applied, describe it'
        )}`,
        sourceText: facts.splintDocumented.sourceText,
        confidence: facts.splintDocumented.confidence,
      });
    }

    // Region: [C] on mismatch, [D] ask when undocumented.
    if (info.kind === 'splint') {
      const region = facts.splintRegion;
      if (region === undefined) {
        codeFindings.push({
          level: 'determines',
          cptCode: code,
          message: `The splinted region is not documented for ${code} — the splint code depends on the body region and splint type. ${whereClause(
            'splintType',
            'Select the Body site and/or name the splint'
          )}`,
        });
      } else if (region.value !== info.region) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `${code} covers a splint of ${REGION_LABELS[info.region]}, but the note documents ${
            REGION_LABELS[region.value]
          }.`,
          sourceText: region.sourceText,
          confidence: region.confidence,
        });
      }
      // Static vs dynamic, both directions, for the code pairs that split on it.
      if (info.staticDynamic !== undefined) {
        if (facts.staticDynamic === undefined) {
          codeFindings.push({
            level: 'determines',
            cptCode: code,
            message: `Whether the splint is static or dynamic is not documented for ${code} — it selects between the static and dynamic codes, and a static splint should say so rather than be assumed. ${whereClause(
              'staticDynamic',
              'Add it'
            )}`,
          });
        } else if (facts.staticDynamic.value !== info.staticDynamic) {
          codeFindings.push({
            level: 'contradiction',
            cptCode: code,
            message: `${code} is the ${info.staticDynamic} splint code, but the note documents a ${facts.staticDynamic.value} splint.`,
            sourceText: facts.staticDynamic.sourceText,
            confidence: facts.staticDynamic.confidence,
          });
        }
      }
    } else if (code === '29580') {
      // The Unna boot is a specific paste dressing — 29580 needs it named, not just a region.
      if (!facts.unnaBootDocumented) {
        if (facts.strapRegion !== undefined) {
          codeFindings.push({
            level: 'contradiction',
            cptCode: code,
            message: `29580 covers an Unna boot, but the note documents strapping of ${
              REGION_LABELS[facts.strapRegion.value]
            } without one — that strapping is reported with ${STRAPPING_CODE_BY_REGION[facts.strapRegion.value]}.`,
            sourceText: facts.strapRegion.sourceText,
            confidence: facts.strapRegion.confidence,
          });
        } else {
          codeFindings.push({
            level: 'determines',
            cptCode: code,
            message: `An Unna boot is not documented for 29580 — it is defined by the Unna boot (zinc paste) dressing. ${whereClause(
              'applianceKind',
              'If one was applied, name it'
            )}`,
          });
        }
      }
    } else {
      const strapRegion = facts.strapRegion;
      if (facts.unnaBootDocumented) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `${code} covers strapping of ${
            REGION_LABELS[info.region]
          }, but the note documents an Unna boot — that is reported with 29580.`,
          sourceText: facts.unnaBootDocumented.sourceText,
          confidence: facts.unnaBootDocumented.confidence,
        });
      } else if (strapRegion === undefined) {
        codeFindings.push({
          level: 'determines',
          cptCode: code,
          message: `The strapped region is not documented for ${code} — the strapping code depends on it. ${whereClause(
            'strapSite',
            'Select it'
          )}`,
        });
      } else if (strapRegion.value !== info.region) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `${code} covers strapping of ${REGION_LABELS[info.region]}, but the note documents ${
            REGION_LABELS[strapRegion.value]
          }.`,
          sourceText: strapRegion.sourceText,
          confidence: strapRegion.confidence,
        });
      }
    }

    // [R] elements every application/strapping code needs.
    if (!facts.applicationDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Application by the clinician is not documented for ${code} — application codes require that the clinician applied (and for splints, molded) the appliance. ${whereClause(
          'application',
          'Record it'
        )}`,
      });
    }
    if (!facts.preNeurovascularDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `A pre-application neurovascular exam is not documented for ${code} — record pulses, motor, sensation, and cap refill before application. ${whereClause(
          'preNeurovascular'
        )}`,
      });
    }
    if (!facts.postNeurovascularDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `A post-application neurovascular exam is not documented for ${code} — re-examine and record pulses, motor, sensation, and cap refill after application. ${whereClause(
          'postNeurovascular'
        )}`,
      });
    }
    // Chest strapping (29200) is the one midline code without a side.
    if (!facts.lateralityDocumented && code !== '29200') {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `Laterality is not documented for ${code}. ${whereClause('laterality', 'Select it')}`,
      });
    }
    // Material is a splint-code requirement (strapping uses tape, not fiberglass/plaster).
    if (info.kind === 'splint' && !facts.materialDocumented) {
      codeFindings.push({
        level: 'required',
        cptCode: code,
        message: `The splint material is not documented for ${code} — record fiberglass or plaster. ${whereClause(
          'material',
          'Record it'
        )}`,
      });
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(code);
    }
    findings.push(...codeFindings);
  }

  if (inScopeSelected.length > 0 && !facts.instructionsDocumented) {
    findings.push({
      level: 'bestPractice',
      message: `Patient instructions are not documented — splint/strapping care and elevation guidance complete the note. ${whereClause(
        'instructions',
        'Record them'
      )}`,
    });
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

// Matches the product procedure type "Splint Application / Immobilization" (and its
// "splint-application" code slug) plus freehand strapping/Unna boot entries. The (?!er)
// guard keeps "splinter" (foreign-body vocabulary) from matching.
const SPLINTING_TYPE_PATTERN = /splint(?!er)|strapp\w*|\btaping\b|immobiliz|unna\s*boot/i;

export const splintingFamily: ProcedureFamilyModel = {
  id: 'splinting',
  displayName: 'Splinting & Strapping',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = SPLINTING_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isSplintingCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractSplintingFacts,
  suggestCode: suggestSplintingCode,
  defendCodes: defendSplintingCodes,
};
