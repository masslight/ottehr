import {
  AnatomicSite,
  extractSite,
  firstMatch,
  lateralityDocumented,
  snippetAround,
  suppliesContain,
  textFlag,
  textMention,
} from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import { defendSelectedCodes, SUPPLIES_FIELD_LABEL, TO_DETAILS, whereClauseFor } from '../family-support';
import {
  citing,
  CodeCandidate,
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
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  textEvidence,
  WhereToDocument,
} from '../model.types';

export type BurnExtentClass = 'small' | 'medium' | 'large';

const BURN_TREATMENT_CODES = {
  small: '16020',
  medium: '16025',
  large: '16030',
} as const satisfies Record<BurnExtentClass, string>;

type BurnTreatmentCode = (typeof BURN_TREATMENT_CODES)[keyof typeof BURN_TREATMENT_CODES];

interface BurnClassInfo {
  code: BurnTreatmentCode;
  display: string;
  coverage: string;
}

const SMALL_BURN_MAX_PERCENT_EXCLUSIVE = 5;
const MEDIUM_BURN_MAX_PERCENT_INCLUSIVE = 10;

const BURN_CLASS_INFO: Record<BurnExtentClass, BurnClassInfo> = {
  small: {
    code: BURN_TREATMENT_CODES.small,
    display: 'Dressings and/or debridement of partial-thickness burns; small (less than 5% total body surface area)',
    coverage: 'less than 5% TBSA',
  },
  medium: {
    code: BURN_TREATMENT_CODES.medium,
    display:
      'Dressings and/or debridement of partial-thickness burns; medium (eg, whole face or whole extremity, or 5% to 10% total body surface area)',
    coverage: '5% to 10% TBSA',
  },
  large: {
    code: BURN_TREATMENT_CODES.large,
    display:
      'Dressings and/or debridement of partial-thickness burns; large (eg, more than 1 extremity, or greater than 10% total body surface area)',
    coverage: 'greater than 10% TBSA',
  },
};

const CLASS_FOR_CODE: Record<string, BurnExtentClass> = Object.fromEntries(
  (Object.entries(BURN_CLASS_INFO) as Array<[BurnExtentClass, BurnClassInfo]>).map(([cls, info]) => [info.code, cls])
);

const BURN_CODE_RANGE = `${BURN_CLASS_INFO.small.code}–${BURN_CLASS_INFO.large.code}`;

export function isBurnTreatmentCode(code: string): code is BurnTreatmentCode {
  return CLASS_FOR_CODE[code] !== undefined;
}

function codeCandidate(cls: BurnExtentClass): CodeCandidate {
  const info = BURN_CLASS_INFO[cls];
  return { code: info.code, display: `${info.code} — ${info.display}` };
}

export function burnClassForPercent(percent: number): BurnExtentClass {
  if (percent < SMALL_BURN_MAX_PERCENT_EXCLUSIVE) return 'small';
  if (percent <= MEDIUM_BURN_MAX_PERCENT_INCLUSIVE) return 'medium';
  return 'large';
}

export type BurnDepthClass = 'first-degree' | 'partial-thickness' | 'full-thickness';

const DEPTH_LABELS: Record<BurnDepthClass, string> = {
  'first-degree': 'a first-degree (superficial epidermal) burn',
  'partial-thickness': 'a partial-thickness (second-degree) burn',
  'full-thickness': 'a full-thickness (third-degree) burn',
};

export interface BurnFacts {
  extentClass?: FactValue<BurnExtentClass>;
  tbsaPercent?: number;
  implausibleTbsaPercent?: FactValue<number>;
  locationDocumented: boolean;
  siteIsLateralizable: boolean;
  lateralityDocumented: boolean;
  degreeDocumented?: FactValue<true>;
  depthClass?: FactValue<BurnDepthClass>;
  mixedFullThickness?: FactValue<true>;
  treatmentDocumented?: FactValue<true>;
}

const PERCENT_THEN_TBSA_PATTERN =
  /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:the\s+)?)?(?:TBSA|BSA|total\s+body\s+surface(?:\s+area)?|body\s+surface(?:\s+area)?)/i;

const TBSA_THEN_PERCENT_PATTERN =
  /(?:TBSA|BSA|total\s+body\s+surface(?:\s+area)?|body\s+surface(?:\s+area)?)[^.;\n]{0,16}?(\d+(?:\.\d+)?)\s*%/i;
const PERCENT_THEN_BURN_PATTERN = /(\d+(?:\.\d+)?)\s*%[^.;\n]{0,30}?\bburn/i;

const BURN_THEN_PERCENT_PATTERN = /\bburn\w*[^.;\n]{0,30}?(\d+(?:\.\d+)?)\s*%/i;

const TBSA_PATTERNS = [
  PERCENT_THEN_TBSA_PATTERN,
  TBSA_THEN_PERCENT_PATTERN,
  PERCENT_THEN_BURN_PATTERN,
  BURN_THEN_PERCENT_PATTERN,
];

const MAX_PLAUSIBLE_TBSA_PERCENT = 100;

const CLASS_PHRASE_PATTERNS: Array<[BurnExtentClass, RegExp]> = [
  [
    'large',
    /\blarge\b[^.;\n]{0,24}\bburn|\bburn\w*[^.;\n]{0,24}\blarge\b|more\s+than\s+(?:one|1)\s+extremit\w+|multiple\s+extremit\w+/i,
  ],
  [
    'medium',
    /\bmedium(?:[-\s]sized)?\b[^.;\n]{0,24}\bburn|\bburn\w*[^.;\n]{0,24}\bmedium\b|whole\s+(?:face|extremity|arm|leg)|entire\s+(?:face|extremity|arm|leg)/i,
  ],
  ['small', /\bsmall\b[^.;\n]{0,24}\bburn|\bburn\w*[^.;\n]{0,24}\bsmall\b/i],
];

const DEPTH_CLASS_PATTERNS: Array<[BurnDepthClass, RegExp]> = [
  ['full-thickness', /full[-\s]?thickness|(?:third|3rd)[-\s]?degree/i],
  ['partial-thickness', /partial[-\s]?thickness|(?:second|2nd)[-\s]?degree|deep\s+dermal\s+burn/i],
  [
    'first-degree',
    /(?:first|1st)[-\s]?degree|superficial\s+burn|epidermal\s+burn|superficial\s+epidermal|erythema\s+only/i,
  ],
];

const DEPTH_MENTION_PATTERN = new RegExp(DEPTH_CLASS_PATTERNS.map(([, pattern]) => pattern.source).join('|'), 'i');

const DEPTH_RESOLUTION_ORDER: BurnDepthClass[] = ['partial-thickness', 'full-thickness', 'first-degree'];

const TREATMENT_PATTERN =
  /\bdress(?:ing|ings|ed)\b|debrid\w*|xeroform|silvadene|silver\s+sulfadiazine|bacitracin|non[-\s]?adherent/i;

const TREATMENT_SUPPLY_PATTERN = /dressing|gauze|xeroform|silvadene|bacitracin|burn\s+kit/i;

const LATERALIZABLE_SITES: AnatomicSite[] = ['ear', 'eyelid', 'axilla', 'extremity', 'hand', 'foot'];

interface TbsaReading {
  percent: number;
  evidence: FactProvenance;
}

function extractTbsaReading(text: string): { extent?: TbsaReading; implausible?: TbsaReading } {
  let implausible: TbsaReading | undefined;
  for (const pattern of TBSA_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found === undefined) continue;
    const groups = new RegExp(pattern.source, pattern.flags).exec(found.match);
    const percent = parseFloat(groups?.[1] ?? '');
    if (!Number.isFinite(percent) || percent <= 0) continue;
    const reading = { percent, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    if (percent <= MAX_PLAUSIBLE_TBSA_PERCENT) return { extent: reading };
    if (implausible === undefined) implausible = reading;
  }
  return { implausible };
}

function extractDepth(text: string): Pick<BurnFacts, 'depthClass' | 'mixedFullThickness'> {
  const matches = new Map<BurnDepthClass, { match: string; index: number }>();
  for (const [cls, pattern] of DEPTH_CLASS_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) matches.set(cls, found);
  }
  for (const cls of DEPTH_RESOLUTION_ORDER) {
    const found = matches.get(cls);
    if (found === undefined) continue;
    const fullThickness = matches.get('full-thickness');
    return {
      depthClass: {
        value: cls,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      },
      mixedFullThickness:
        cls === 'partial-thickness' && fullThickness !== undefined
          ? {
              value: true,
              evidence: textEvidence(snippetAround(text, fullThickness.index, fullThickness.match.length)),
            }
          : undefined,
    };
  }
  return {};
}

export function extractBurnFacts(input: ProcedureFactsInput): BurnFacts {
  const text = input.procedureDetails ?? '';
  let extentClass: FactValue<BurnExtentClass> | undefined;
  let tbsaPercent: number | undefined;
  const { extent, implausible } = extractTbsaReading(text);

  if (extent !== undefined) {
    tbsaPercent = extent.percent;
    extentClass = { value: burnClassForPercent(extent.percent), evidence: extent.evidence };
  } else if (implausible === undefined) {
    for (const [cls, pattern] of CLASS_PHRASE_PATTERNS) {
      const found = firstMatch(text, pattern);
      if (found) {
        extentClass = {
          value: cls,
          evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
        };
        break;
      }
    }
  }

  let treatmentDocumented = textFlag(text, TREATMENT_PATTERN);

  if (!treatmentDocumented && suppliesContain(input, TREATMENT_SUPPLY_PATTERN)) {
    treatmentDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }

  const site = extractSite(input, text);

  return {
    extentClass,
    tbsaPercent,
    implausibleTbsaPercent:
      implausible === undefined ? undefined : { value: implausible.percent, evidence: implausible.evidence },
    locationDocumented: Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) || site !== undefined,
    siteIsLateralizable: site !== undefined && LATERALIZABLE_SITES.includes(site.value),
    lateralityDocumented: lateralityDocumented(input, text),
    degreeDocumented: textMention(text, DEPTH_MENTION_PATTERN),
    ...extractDepth(text),
    treatmentDocumented,
  };
}

function extentPhrase(facts: BurnFacts): string {
  if (facts.tbsaPercent !== undefined) return `${facts.tbsaPercent}% TBSA`;
  const cls = facts.extentClass?.value;
  return cls !== undefined ? `a ${cls} burn` : 'the burn extent';
}

const EXTENT_ASK_CLAUSE =
  'the treated extent selects the code (16020 small, <5% TBSA; 16025 medium, 5–10%; 16030 large, >10%)';

const PARTIAL_THICKNESS_CLAUSE = `${BURN_CODE_RANGE} are the dressing and/or debridement codes for partial-thickness burns`;

const WHERE_TO_DOCUMENT = {
  extent: { destination: TO_DETAILS, example: '"~7% TBSA partial-thickness burn"' },
  site: { destination: 'in the Site/location field' },
  laterality: { destination: 'in the Side of body field' },
  degree: { destination: TO_DETAILS, example: '"partial-thickness (second-degree)"' },
  treatment: { destination: TO_DETAILS, example: '"cleansed, bacitracin and non-adherent dressing applied"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function firstDegreeMessage(subject: string): string {
  return `${subject} — ${PARTIAL_THICKNESS_CLAUSE}, and the note documents ${
    DEPTH_LABELS['first-degree']
  }. Initial treatment of a first-degree burn is 16000, which is outside this model's scope and is not assessed. ${whereClause(
    'degree',
    ifPerformedClause('dressed or debrided', 'record that depth', 'a partial-thickness burn')
  )}`;
}

function fullThicknessMessage(subject: string): string {
  return `${subject} — ${PARTIAL_THICKNESS_CLAUSE}, and the note documents ${
    DEPTH_LABELS['full-thickness']
  }. Care directed at a full-thickness burn is coded outside this model's scope and is not assessed. ${whereClause(
    'degree',
    ifPerformedClause('also dressed or debrided', 'record that depth', 'partial-thickness burn')
  )}`;
}

const MIXED_DEPTH_MESSAGE = `The note documents ${DEPTH_LABELS['partial-thickness']} with full-thickness areas — ${BURN_CODE_RANGE} describe the partial-thickness dressings and/or debridement, and any care directed at the full-thickness areas is coded outside this model's scope (not assessed).`;

function depthAskMessage(subject: string): string {
  return `The burn depth is not documented${subject} — ${PARTIAL_THICKNESS_CLAUSE}, so the note should record the depth treated (initial treatment of a first-degree burn is 16000 instead). ${whereClause(
    'degree'
  )}`;
}

function implausibleExtentMessage(subject: string, percent: number): string {
  return `The documented extent (${percent}%) is not a possible share of total body surface area${subject} — TBSA cannot exceed 100%, so the figure is not read as the treated extent and ${EXTENT_ASK_CLAUSE}. ${whereClause(
    'extent',
    'Re-record the extent'
  )}`;
}

function outOfScopeDepthMessage(depth: BurnDepthClass, subject: string): string | undefined {
  if (depth === 'first-degree') return firstDegreeMessage(subject);
  if (depth === 'full-thickness') return fullThicknessMessage(subject);
  return undefined;
}

function suggestBurnTreatmentCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractBurnFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const depth = facts.depthClass;
  const outOfScopeDepth = depth === undefined ? undefined : outOfScopeDepthMessage(depth.value, 'No code is suggested');

  if (depth !== undefined && outOfScopeDepth !== undefined) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: outOfScopeDepth,
      evidence: citing(depth),
    });
    evaluation.outcome = notAssessedCode(outOfScopeDepth);
    return evaluation;
  }

  if (facts.mixedFullThickness) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: MIXED_DEPTH_MESSAGE,
      evidence: citing(facts.mixedFullThickness),
    });
  }

  if (depth === undefined) {
    findings.push({ level: 'required', scope: ENTRY_SCOPE, message: depthAskMessage(''), evidence: NOTHING_TO_CITE });
  }

  if (facts.extentClass === undefined) {
    const implausiblePercent = facts.implausibleTbsaPercent;

    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message:
        implausiblePercent === undefined
          ? `The burn's extent is not documented — ${EXTENT_ASK_CLAUSE}. ${whereClause('extent')}`
          : implausibleExtentMessage('', implausiblePercent.value),
      evidence: citing(implausiblePercent),
    });

    evaluation.outcome = openCodeSet(
      [codeCandidate('small'), codeCandidate('medium'), codeCandidate('large')],
      `${BURN_CODE_RANGE} — the treated burn extent (TBSA %) determines the exact code`
    );
    return evaluation;
  }

  const cls = facts.extentClass.value;
  const info = BURN_CLASS_INFO[cls];

  evaluation.outcome = determinedCode({
    code: info.code,
    display: `${info.code} — ${info.display}`,
    justification: `Burn dressing/debridement — ${extentPhrase(facts)} documented (${cls}, ${info.coverage}) → ${
      info.code
    }.`,
  });

  return evaluation;
}

function defendBurnTreatmentCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractBurnFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const documentedClass = facts.extentClass?.value;
  const depth = facts.depthClass;

  defendSelectedCodes(
    input,
    evaluation,
    (code) => CLASS_FOR_CODE[code],
    (codeClass, code, codeFindings) => {
      const outOfScopeDepth =
        depth === undefined ? undefined : outOfScopeDepthMessage(depth.value, `${code} is selected`);

      if (depth !== undefined && outOfScopeDepth !== undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: outOfScopeDepth,
          evidence: citing(depth),
        });
      } else if (depth === undefined) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: depthAskMessage(` for ${code}`),
          evidence: NOTHING_TO_CITE,
        });
      }

      if (outOfScopeDepth === undefined) {
        if (documentedClass === undefined) {
          const implausiblePercent = facts.implausibleTbsaPercent;
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message:
              implausiblePercent === undefined
                ? `The burn's extent is not documented for ${code} — ${EXTENT_ASK_CLAUSE}. ${whereClause('extent')}`
                : implausibleExtentMessage(` for ${code}`, implausiblePercent.value),
            evidence: citing(implausiblePercent),
          });
        } else if (documentedClass !== codeClass) {
          const codeInfo = BURN_CLASS_INFO[codeClass];
          const documentedInfo = BURN_CLASS_INFO[documentedClass];
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers a ${codeClass} burn (${codeInfo.coverage}), but the note documents ${extentPhrase(
              facts
            )} (${documentedClass}, ${documentedInfo.coverage}) — as documented this supports ${documentedInfo.code}.`,
            evidence: citing(facts.extentClass),
          });
        }
      }

      const codeDefiningFactsDocumented = depth?.value === 'partial-thickness' && documentedClass !== undefined;

      if (codeDefiningFactsDocumented && !facts.locationDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The burn location is not documented for ${code}. ${whereClause('site', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (codeDefiningFactsDocumented && facts.siteIsLateralizable && !facts.lateralityDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `Laterality is not documented for ${code} — the documented site is a paired one, so a complete note records which side was burned. ${whereClause(
            'laterality',
            'Select it'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.treatmentDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The treatment performed is not documented for ${code} — the note should describe the dressing and/or debridement. ${whereClause(
            'treatment'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (facts.mixedFullThickness && selected.some((c) => isBurnTreatmentCode(c.code))) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: MIXED_DEPTH_MESSAGE,
      evidence: citing(facts.mixedFullThickness),
    });
  }

  return evaluation;
}

export const burnTreatmentFamily: ProcedureFamilyModel = {
  id: 'burn-treatment',
  displayName: 'Burn Treatment / Dressing',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('burn-treatment', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isBurnTreatmentCode(c.code))
  ),
  suggestCode: suggestBurnTreatmentCode,
  defendCodes: defendBurnTreatmentCodes,
};
