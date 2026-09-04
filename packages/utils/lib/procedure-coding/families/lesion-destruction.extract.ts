import {
  extractAnesthesiaDocumented,
  firstMatch,
  lateralityDocumented,
  snippetAround,
  techniqueOrTextFlag,
} from '../extract';
import { DIAGNOSIS_FIELD_LABEL } from '../family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';

export type ExcludedLesionType = 'skin-tag' | 'vascular-proliferative' | 'premalignant';

interface ExcludedLesionInfo {
  label: string;
  codes: string;
  text: RegExp;
  dxCode: RegExp;
}

export const EXCLUDED_LESION_INFO: Record<ExcludedLesionType, ExcludedLesionInfo> = {
  'skin-tag': {
    label: 'skin tags',
    codes: '11200 (up to 15 skin tags) and 11201 (each additional 10)',
    text: /skin\s+tags?|acrochordon\w*|fibroepithelial\s+polyps?/i,
    dxCode: /^L91\.?8/i,
  },
  'vascular-proliferative': {
    label: 'cutaneous vascular proliferative lesions',
    codes: '17106–17108 (destruction of cutaneous vascular proliferative lesions)',
    text: /cherry\s+angioma\w*|\bangiomas?\b|h[ae]mangioma\w*|pyogenic\s+granuloma\w*|telangiectas\w*|spider\s+(?:angioma\w*|vein\w*)|vascular\s+(?:proliferat\w*|malformation\w*)/i,
    dxCode: /^D18\.?0/i,
  },
  premalignant: {
    label: 'premalignant lesions (e.g. actinic keratoses)',
    codes: '17000 (first lesion), 17003 (each additional, up to 14) and 17004 (15 or more)',
    text: /actinic\s+kerato\w*|solar\s+kerato\w*|premalignant|pre-?cancerous|bowen'?s\s+disease/i,
    dxCode: /^L57\.?0/i,
  },
};

export interface LesionDestructionFacts {
  lesionCount?: FactValue<number>;
  implausibleLesionCount?: FactValue<number>;
  excludedLesionType?: FactValue<ExcludedLesionType>;
  methodDocumented?: FactValue<true>;
  locationsDocumented: boolean;
  lateralityDocumented: boolean;
  anesthesiaDocumented?: FactValue<true>;
}

const MAX_PLAUSIBLE_LESION_COUNT = 100;
const LESION_WORDS_SOURCE = String.raw`lesions?|warts?|verruca[es]?|verruca|molluscum|papillomas?`;
const NON_LESION_COUNT_NOUNS_SOURCE = String.raw`cycles?|freeze-?thaws?|thaws?|doses?|applications?|passes|sprays?|attempts?|sessions?|visits?|minutes?|seconds?|days?|weeks?|months?|mg|ml|cm|mm`;

const LESION_WORD_THEN_COUNT_PATTERN = new RegExp(
  String.raw`(?:${LESION_WORDS_SOURCE})\s*(?:[x×#]|count:?)\s*(\d+)\b`,
  'i'
);

const COUNT_THEN_LESION_WORD_PATTERN = new RegExp(
  String.raw`(?<![\d/–-])(\d+)\s+(?:(?!(?:${NON_LESION_COUNT_NOUNS_SOURCE})\b)[\w–-]+\s+){0,2}?(?:${LESION_WORDS_SOURCE})\b`,
  'i'
);

const SINGLE_LESION_PATTERN = new RegExp(
  String.raw`\b(?:a\s+single|single|one)\s+(?:[\w–-]+\s+){0,2}?(?:lesion|wart|verruca)\b`,
  'i'
);

const COUNT_PATTERNS = [LESION_WORD_THEN_COUNT_PATTERN, COUNT_THEN_LESION_WORD_PATTERN];
const CRYO_METHOD_PATTERN = /cryotherap\w*|cryosurg\w*|\bcryo\b|liquid\s+nitrogen|\bLN2?\b|freez\w*|frozen/i;

const LESION_LOCATION_PATTERN = new RegExp(
  String.raw`(?:${LESION_WORDS_SOURCE})[^.;\n]{0,30}\b(?:on|of|over|at)\b|\b(?:plantar|periungual|palmar|dorsal)\b`,
  'i'
);

const EXCLUDED_LESION_TYPES = Object.entries(EXCLUDED_LESION_INFO) as Array<[ExcludedLesionType, ExcludedLesionInfo]>;

function extractLesionCount(text: string): Pick<LesionDestructionFacts, 'lesionCount' | 'implausibleLesionCount'> {
  let implausible: FactValue<number> | undefined;

  for (const pattern of COUNT_PATTERNS) {
    const found = firstMatch(text, pattern);

    if (found === undefined) continue;

    const groups = new RegExp(pattern.source, pattern.flags).exec(found.match);
    const count = parseInt(groups?.[1] ?? '', 10);

    if (!Number.isFinite(count) || count <= 0) continue;

    const fact: FactValue<number> = {
      value: count,
      evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
    };

    if (count <= MAX_PLAUSIBLE_LESION_COUNT) return { lesionCount: fact };

    if (implausible === undefined) implausible = fact;
  }
  if (implausible !== undefined) return { implausibleLesionCount: implausible };
  const single = firstMatch(text, SINGLE_LESION_PATTERN);

  if (single) {
    return {
      lesionCount: { value: 1, evidence: textEvidence(snippetAround(text, single.index, single.match.length)) },
    };
  }

  return {};
}

function extractExcludedLesionType(
  input: ProcedureFactsInput,
  text: string
): FactValue<ExcludedLesionType> | undefined {
  const diagnoses = input.diagnoses ?? [];

  for (const [type, info] of EXCLUDED_LESION_TYPES) {
    const dx = diagnoses.find((entry) => info.dxCode.test(entry.code) || info.text.test(entry.display));

    if (dx) return { value: type, evidence: fieldEvidence(DIAGNOSIS_FIELD_LABEL) };
  }

  for (const [type, info] of EXCLUDED_LESION_TYPES) {
    const found = firstMatch(text, info.text);

    if (found) {
      return { value: type, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    }
  }

  return undefined;
}

export function extractLesionDestructionFacts(input: ProcedureFactsInput): LesionDestructionFacts {
  const text = input.procedureDetails ?? '';

  return {
    ...extractLesionCount(text),
    excludedLesionType: extractExcludedLesionType(input, text),
    methodDocumented: techniqueOrTextFlag(input, text, CRYO_METHOD_PATTERN),
    locationsDocumented:
      Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) ||
      firstMatch(text, LESION_LOCATION_PATTERN) !== undefined,
    lateralityDocumented: lateralityDocumented(input, text),
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
  };
}
