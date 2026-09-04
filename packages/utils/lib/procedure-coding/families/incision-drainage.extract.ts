import {
  extractAnesthesiaDocumented,
  extractSite,
  firstMatch,
  INCISION_PATTERN,
  lesionSizeDocumented,
  snippetAround,
  suppliesContain,
  textFlag,
} from '../extract';
import { SITE_FIELD_LABEL, SUPPLIES_FIELD_LABEL, TECHNIQUE_FIELD_LABEL } from '../family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';

export type IncisionDrainageComplexityElement =
  | 'loculations-dissection'
  | 'probing'
  | 'packing'
  | 'drain-placement'
  | 'multiple-abscesses';

export type IncisionDrainageOutOfScopeSite = 'pilonidal' | 'perianal' | 'external-ear' | 'finger' | 'hematoma-seroma';

export interface IncisionDrainageFacts {
  locationDocumented: boolean;
  outOfScopeSite?: FactValue<IncisionDrainageOutOfScopeSite>;
  complexityElements: FactValue<IncisionDrainageComplexityElement>[];
  incisionDocumented?: FactValue<true>;
  drainageDocumented?: FactValue<true>;
  sizeDocumented: boolean;
  anesthesiaDocumented?: FactValue<true>;
  cultureDocumented: boolean;
  dressingOrToleranceDocumented?: FactValue<true>;
}

const ABSCESS_HISTORY_SOURCE = String.raw`\bhistor\w*|\bh\/o\b|\bhx\b|\brecurrent\b|\brecurring\b|\bchronic\b|\bprior\b|\bprevious\b|\bpast\b|\bknown\b|\brepeated\b`;

const ABSCESS_PLURAL_SOURCE = String.raw`(?<!(?:${ABSCESS_HISTORY_SOURCE})[^.;\n]{0,20})(?:(?:multiple|two|three|four|five|several|second)\s+(?:separate\s+|distinct\s+|additional\s+)?abscess(?:es)?\b|\babscesses\b)`;

const DRAINED_HERE_SOURCE = String.raw`incis\w*|drain\w*|lanc(?:e|ed|ing)\b|evacuat\w*|\bI\s*&\s*D\b`;

export const INCISION_DRAINAGE_COMPLEXITY_ELEMENT_PATTERNS: Array<[IncisionDrainageComplexityElement, RegExp]> = [
  [
    'loculations-dissection',
    /blunt(?:ly)?\s+dissect\w*|loculat\w*(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,40}(?:broken|lysed|disrupted|opened|dissected)|(?:broke|broken|breaking|lys(?:ed|is)|disrupt\w*)(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,40}loculat\w*/i,
  ],
  ['probing', /\bprob(?:e|ed|ing)\b/i],
  ['packing', /\bpack(?:ed|ing)\b|iodoform|\bwick\b/i],
  [
    'drain-placement',
    /\bpenrose\b|\bdrain\b(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,30}\b(?:placed|inserted|left|secured|sutured)\b|\b(?:placed|inserted|left)\b(?:(?!\b(?:no|not|without)\b)[^.;\n]){0,24}\bdrain\b/i,
  ],
  [
    'multiple-abscesses',
    new RegExp(
      [
        String.raw`(?:${ABSCESS_PLURAL_SOURCE})[^.;\n]{0,40}?\b(?:${DRAINED_HERE_SOURCE})`,
        String.raw`\b(?:${DRAINED_HERE_SOURCE})[^.;\n]{0,40}?(?:${ABSCESS_PLURAL_SOURCE})`,
      ].join('|'),
      'i'
    ),
  ],
];

const OUT_OF_SCOPE_SITE_PATTERNS: Array<[IncisionDrainageOutOfScopeSite, RegExp]> = [
  ['pilonidal', /pilonidal/i],
  ['perianal', /peri-?anal|peri-?rectal|ischio-?rectal|intersphincteric/i],
  ['external-ear', /external\s+ear|auricl\w*|\bpinna\b|ear-?lobe|perichondr\w*/i],
  ['finger', /\bfingers?\b|\bfingertip\b|\bthumb\b|\bfelon\b|paronychia/i],
  ['hematoma-seroma', /h[ae]matoma|seroma|fluid\s+collection/i],
];

const COMPLEXITY_ELEMENT_SUPPLY_PATTERNS: Partial<Record<IncisionDrainageComplexityElement, RegExp>> = {
  packing: /iodoform|packing|\bwick\b/i,
  'drain-placement': /\bdrains?\b|\bpenrose\b/i,
};

const DRAINAGE_PATTERN =
  /purulent|\bpus\b|serosanguin\w*|sanguineous|seropurulent|express(?:ed|ion)\b|evacuat\w*|drain(?:ed|age)\b/i;

const CULTURE_PATTERN = /\bculture(?:s|d)?\b|c\s*&\s*s\b|gram\s+stain|wound\s+swab/i;

const DRESSING_TOLERANCE_PATTERN = /dress(?:ing|ed)\b|bandag\w*|band-?aid|gauze[^.;\n]{0,20}applied|tolerat\w*/i;

function extractOutOfScopeSite(
  input: ProcedureFactsInput,
  text: string
): FactValue<IncisionDrainageOutOfScopeSite> | undefined {
  const structured = [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');

  if (structured.trim().length > 0) {
    for (const [site, pattern] of OUT_OF_SCOPE_SITE_PATTERNS) {
      if (pattern.test(structured)) return { value: site, evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }
  }

  for (const [site, pattern] of OUT_OF_SCOPE_SITE_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      return { value: site, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
    }
  }

  return undefined;
}

export function extractIncisionDrainageFacts(input: ProcedureFactsInput): IncisionDrainageFacts {
  const text = input.procedureDetails ?? '';
  const complexityElements: FactValue<IncisionDrainageComplexityElement>[] = [];

  for (const [element, pattern] of INCISION_DRAINAGE_COMPLEXITY_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      complexityElements.push({
        value: element,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      });
      continue;
    }

    if ((input.technique ?? []).some((value) => pattern.test(value))) {
      complexityElements.push({ value: element, evidence: fieldEvidence(TECHNIQUE_FIELD_LABEL) });
      continue;
    }

    const supplyPattern = COMPLEXITY_ELEMENT_SUPPLY_PATTERNS[element];

    if (supplyPattern !== undefined && suppliesContain(input, supplyPattern)) {
      complexityElements.push({ value: element, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) });
    }
  }

  return {
    locationDocumented:
      Boolean(input.bodySite?.trim() || input.otherBodySite?.trim()) || extractSite(input, text) !== undefined,
    outOfScopeSite: extractOutOfScopeSite(input, text),
    complexityElements,
    incisionDocumented: textFlag(text, INCISION_PATTERN),
    drainageDocumented: textFlag(text, DRAINAGE_PATTERN),
    sizeDocumented: lesionSizeDocumented(input, text),
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    cultureDocumented: input.specimenSent !== undefined || firstMatch(text, CULTURE_PATTERN) !== undefined,
    dressingOrToleranceDocumented: textFlag(text, DRESSING_TOLERANCE_PATTERN),
  };
}
