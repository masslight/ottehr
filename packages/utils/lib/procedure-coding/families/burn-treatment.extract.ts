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
import { SUPPLIES_FIELD_LABEL } from '../family-support';
import { FactProvenance, FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';
import type { BurnDepthClass, BurnExtentClass } from './burn-treatment.rules';
import { burnClassForPercent } from './burn-treatment.rules';

export type { BurnDepthClass, BurnExtentClass };

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

const MAX_PLAUSIBLE_TBSA_PERCENT = 100;

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
      depthClass: { value: cls, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) },
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
        extentClass = { value: cls, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
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
