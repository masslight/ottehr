import {
  extractAnesthesiaDocumented,
  firstMatch,
  lateralityDocumented,
  snippetAround,
  techniqueOrTextFlag,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import {
  codeCandidateFrom,
  defendSelectedCodes,
  DIAGNOSIS_FIELD_LABEL,
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
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  textEvidence,
  WhereToDocument,
} from '../model.types';

const LESION_DESTRUCTION_CODES = {
  upToBoundary: '17110',
  overBoundary: '17111',
} as const;

type LesionDestructionCode = (typeof LESION_DESTRUCTION_CODES)[keyof typeof LESION_DESTRUCTION_CODES];

const LESION_DESTRUCTION_CODE_DISPLAYS = {
  [LESION_DESTRUCTION_CODES.upToBoundary]:
    'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; up to 14 lesions',
  [LESION_DESTRUCTION_CODES.overBoundary]:
    'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; 15 or more lesions',
} as const satisfies Record<LesionDestructionCode, string>;

export const LESION_COUNT_BOUNDARY = 14;

const MAX_PLAUSIBLE_LESION_COUNT = 100;

export function isLesionDestructionCode(code: string): code is LesionDestructionCode {
  return code in LESION_DESTRUCTION_CODE_DISPLAYS;
}

const codeCandidate = codeCandidateFrom(LESION_DESTRUCTION_CODE_DISPLAYS);

function codeForCount(count: number): LesionDestructionCode {
  return count <= LESION_COUNT_BOUNDARY ? LESION_DESTRUCTION_CODES.upToBoundary : LESION_DESTRUCTION_CODES.overBoundary;
}

export type ExcludedLesionType = 'skin-tag' | 'vascular-proliferative' | 'premalignant';

interface ExcludedLesionInfo {
  label: string;
  codes: string;
  text: RegExp;
  dxCode: RegExp;
}

const EXCLUDED_LESION_INFO: Record<ExcludedLesionType, ExcludedLesionInfo> = {
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

const EXCLUDED_LESION_TYPES = Object.entries(EXCLUDED_LESION_INFO) as Array<[ExcludedLesionType, ExcludedLesionInfo]>;

export interface LesionDestructionFacts {
  lesionCount?: FactValue<number>;
  implausibleLesionCount?: FactValue<number>;
  excludedLesionType?: FactValue<ExcludedLesionType>;
  methodDocumented?: FactValue<true>;
  locationsDocumented: boolean;
  lateralityDocumented: boolean;
  anesthesiaDocumented?: FactValue<true>;
}

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

const CRYO_METHOD_PATTERN = /cryotherap\w*|cryosurg\w*|\bcryo\b|liquid\s+nitrogen|\bLN2?\b|freez\w*|frozen/i;

const LESION_LOCATION_PATTERN = new RegExp(
  String.raw`(?:${LESION_WORDS_SOURCE})[^.;\n]{0,30}\b(?:on|of|over|at)\b|\b(?:plantar|periungual|palmar|dorsal)\b`,
  'i'
);

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

const COUNT_ASK_CLAUSE =
  'the number of lesions treated selects the code (17110 covers up to 14 lesions; 17111 is 15 or more)';

const BOTH_CODES = '17110/17111';

const WHERE_TO_DOCUMENT = {
  count: { destination: TO_DETAILS, example: '"12 warts treated with liquid nitrogen"' },
  method: { destination: TO_DETAILS, example: '"liquid nitrogen applied to each lesion, two freeze-thaw cycles"' },
  locations: { destination: 'in the Site/location field, or describe the treated locations in Procedure details' },
  laterality: { destination: 'in the Side of body field' },
  lesionType: { destination: TO_DETAILS, example: '"6 verrucae destroyed with liquid nitrogen"' },
  anesthesia: { destination: 'in the Anaesthesia / medication used field', example: '"topical lidocaine"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function excludedLesionMessage(type: ExcludedLesionType, subject: string): string {
  const info = EXCLUDED_LESION_INFO[type];
  return `${subject} — ${BOTH_CODES} cover destruction of benign lesions other than skin tags or cutaneous vascular proliferative lesions, and the note documents ${
    info.label
  }, which is reported with ${info.codes} (outside this model's scope; not assessed). ${whereClause(
    'lesionType',
    'If other benign lesions were also destroyed, record them and their own count'
  )}`;
}

function implausibleCountMessage(subject: string, count: number): string {
  return `The documented lesion count (${count})${subject} is not a plausible number of lesions destroyed in one session, so it is not read as the count — ${COUNT_ASK_CLAUSE}. ${whereClause(
    'count',
    'Re-record the count'
  )}`;
}

function countAskMessage(subject: string): string {
  return `The number of lesions treated is not documented${subject} — ${COUNT_ASK_CLAUSE}. ${whereClause('count')}`;
}

function suggestLesionDestructionCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLesionDestructionFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const excluded = facts.excludedLesionType;
  if (excluded !== undefined) {
    const message = excludedLesionMessage(excluded.value, 'No code is suggested');
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message,
      evidence: citing(excluded),
    });
    evaluation.outcome = notAssessedCode(message);
    return evaluation;
  }

  if (facts.lesionCount === undefined) {
    const implausibleCount = facts.implausibleLesionCount;
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message:
        implausibleCount === undefined ? countAskMessage('') : implausibleCountMessage('', implausibleCount.value),
      evidence: citing(implausibleCount),
    });
    evaluation.outcome = openCodeSet(
      [codeCandidate(LESION_DESTRUCTION_CODES.upToBoundary), codeCandidate(LESION_DESTRUCTION_CODES.overBoundary)],
      '17110–17111 — the number of lesions treated determines the code'
    );
    return evaluation;
  }

  const count = facts.lesionCount.value;
  const code = codeForCount(count);
  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: `Benign lesion destruction — ${count} lesion${count === 1 ? '' : 's'} documented (${
      code === LESION_DESTRUCTION_CODES.upToBoundary ? 'up to 14' : '15 or more'
    }) → ${code}.`,
  });
  return evaluation;
}

function defendLesionDestructionCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLesionDestructionFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const count = facts.lesionCount?.value;
  const excluded = facts.excludedLesionType;

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isLesionDestructionCode(code) ? code : undefined),
    (_info, code, codeFindings) => {
      if (excluded !== undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: excludedLesionMessage(excluded.value, `${code} is selected`),
          evidence: citing(excluded),
        });
      } else if (count === undefined) {
        const implausibleCount = facts.implausibleLesionCount;
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message:
            implausibleCount === undefined
              ? countAskMessage(` for ${code}`)
              : implausibleCountMessage(` for ${code}`, implausibleCount.value),
          evidence: citing(implausibleCount),
        });
      } else if (code === LESION_DESTRUCTION_CODES.overBoundary && count <= LESION_COUNT_BOUNDARY) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `17111 covers 15 or more lesions, but the note documents ${count} — as documented this supports 17110 (up to 14 lesions).`,
          evidence: citing(facts.lesionCount),
        });
      } else if (code === LESION_DESTRUCTION_CODES.upToBoundary && count > LESION_COUNT_BOUNDARY) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `17110 covers up to 14 lesions, but the note documents ${count} — as documented this supports 17111 (15 or more lesions).`,
          evidence: citing(facts.lesionCount),
        });
      }

      if (!facts.methodDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The destruction method is not documented for ${code} — the note should say how the lesions were destroyed (e.g. liquid nitrogen). ${whereClause(
            'method'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      if (!facts.locationsDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The treated locations are not documented for ${code}. ${whereClause('locations', 'Record them')}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (selected.some((c) => isLesionDestructionCode(c.code))) {
    if (!facts.lateralityDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `The side is not documented — 17110 and 17111 are not unilateral codes, so it does not select the code, but for a paired site it completes the note. ${whereClause(
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
        message: `Anesthesia is not noted — cryotherapy is usually performed without any, and it does not affect these codes, but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}

export const lesionDestructionFamily: ProcedureFamilyModel = {
  id: 'lesion-destruction',
  displayName: 'Wart / Benign Lesion Destruction',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('lesion-destruction', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isLesionDestructionCode(c.code))
  ),
  suggestCode: suggestLesionDestructionCode,
  defendCodes: defendLesionDestructionCodes,
};
