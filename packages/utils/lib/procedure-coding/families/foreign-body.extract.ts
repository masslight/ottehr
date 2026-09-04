import {
  AnatomicSite,
  extractAnesthesiaDocumented,
  extractSite,
  firstMatch,
  HEMOSTASIS_PATTERN,
  INCISION_PATTERN,
  lateralityDocumented,
  lesionSizeDocumented,
  normalizeAnatomicSite,
  snippetAround,
  textFlag,
  textMention,
  TM_INTACT_PATTERN,
} from '../extract';
import { MEDICATION_FIELD_LABEL, SITE_FIELD_LABEL, TECHNIQUE_FIELD_LABEL } from '../family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';

export type ForeignBodySite = 'skin' | 'nose' | 'eye' | 'ear';
export type EyeStructure = 'cornea' | 'conjunctiva' | 'eyelid';
export type ForeignBodyComplicationElement =
  | 'deep-dissection'
  | 'multiple-foreign-bodies'
  | 'imaging-localization'
  | 'stated-complicated';

export interface ForeignBodyFacts {
  site?: FactValue<ForeignBodySite>;
  eyeStructure?: FactValue<EyeStructure>;
  incisionDocumented?: FactValue<true>;
  complicationElements: FactValue<ForeignBodyComplicationElement>[];
  slitLampDocumented?: FactValue<true>;
  withoutSlitLampDocumented?: FactValue<true>;
  descriptionDocumented?: FactValue<true>;
  outcomeDocumented?: FactValue<true>;
  postAssessmentDocumented?: FactValue<true>;
  anesthesiaDocumented?: FactValue<true>;
  generalAnesthesiaDocumented?: FactValue<true>;
  sizeDocumented: boolean;
  lateralityRequired: boolean;
  lateralityDocumented: boolean;
}

const BRANCH_PATTERNS: Array<[ForeignBodySite, RegExp]> = [
  ['eye', /\beyes?\b|cornea\w*|conjunctiv\w*|ocular|eyelid/i],
  ['nose', /\bnose\b|nasal|nostril|nares?\b|intranasal/i],
  ['ear', /\bears?\b|ear\s+canal|auditory\s+canal|auricle|pinna/i],
  ['skin', /\bskin\b|soft\s+tissue|subcutaneous|\bsub-?q\b/i],
];

const EYE_STRUCTURE_PATTERNS: Array<[EyeStructure, RegExp]> = [
  ['cornea', /cornea\w*/i],
  ['conjunctiva', /conjunctiv\w*|subtarsal|palpebral\s+fornix/i],
  ['eyelid', /eyelids?|\b(?:upper|lower)\s+lid\b|tarsal\s+plate/i],
];

const CORNEAL_WITHOUT_SLIT_LAMP_PATTERN = /cornea\w*[^.;\n]{0,80}\b(?:without|no)\s+(?:a\s+)?slit[-\s]?lamp\b/i;

const DEEP_DISSECTION_PATTERN =
  /deep(?:er)?\s+dissect\w*|dissect(?:ed|ion)\s+(?:deep|down)|dissect\w*[^.;\n]{0,30}\b(?:fascia|muscle|deep)|extensive\s+dissect\w*/i;

const MULTIPLE_FOREIGN_BODIES_PATTERN =
  /(?:multiple|several|numerous)\s+(?:\w+\s+){0,2}?(?:foreign\s+bodies|splinters|thorns|pellets|beads|shards|slivers|stingers)\b|\b(?:two|three|four|five|\d{1,2})\s+(?:separate|distinct|additional)\s+foreign\s+bod(?:y|ies)\b/i;

const IMAGING_LOCALIZATION_PATTERN =
  /(?:ultrasound|sonograph\w*|x-?ray|radiograph\w*|fluoroscop\w*)[^.;\n]{0,40}?(?:guid\w*|localiz\w*|assist\w*)|(?:guid\w*|localiz\w*|assist\w*)[^.;\n]{0,20}?(?:ultrasound|sonograph\w*|x-?ray|radiograph\w*|fluoroscop\w*)/i;

const STATED_COMPLICATED_PATTERN = /complicated\s+(?:removal|extraction|foreign[-\s]body)/i;

export const FOREIGN_BODY_COMPLICATION_ELEMENT_PATTERNS: Array<[ForeignBodyComplicationElement, RegExp]> = [
  ['deep-dissection', DEEP_DISSECTION_PATTERN],
  ['multiple-foreign-bodies', MULTIPLE_FOREIGN_BODIES_PATTERN],
  ['imaging-localization', IMAGING_LOCALIZATION_PATTERN],
  ['stated-complicated', STATED_COMPLICATED_PATTERN],
];

const SLIT_LAMP_PATTERN = /slit[-\s]?lamp|biomicroscop\w*/i;

const WITHOUT_SLIT_LAMP_PATTERN = /\b(?:without|no)\s+(?:a\s+)?slit[-\s]?lamp\b/i;

const FOREIGN_BODY_DESCRIPTION_PATTERN =
  /splinter|\bglass\b|metal(?:lic)?\b|wood(?:en)?\b|\bthorn\b|\bbead\b|\bBB\b|pellet|pebble|gravel|fish\s*-?\s*hook|\bneedle\b|\bpin\b|\btack\b|insect|\bbug\b|\btick\b|\bbee\b|stinger|\bbean\b|\bseed\b|popcorn|plastic|eraser|\btoy\b|button|batter(?:y|ies)|crayon|\bsand\b|\bdirt\b|cotton|\brock\b|\bstone\b|\bfood\b/i;

const OUTCOME_PATTERN =
  /(?:removed|retrieved|extracted|expelled)\s+(?:completely|intact|in\s+(?:its\s+)?entirety|in\s+total|whole)|complete(?:ly)?\s+(?:removed|removal|extracted|retrieved)|removal\s+(?:was\s+)?complete|(?:no|without)\s+(?:residual|retained)\s+(?:foreign\s+body|fragments?|material)/i;

const FLUORESCEIN_PATTERN = /fluorescein|seidel|wood'?s\s+lamp/i;
const GENERAL_ANESTHESIA_PATTERN =
  /general\s+anesthe\w*|\bGETA\b|endotracheal\s+(?:tube|intubation|anesthe\w*)|(?:procedural|moderate|conscious|deep|IV|intravenous)\s+sedation|under\s+sedation|\bsedated\b|\bketamine\b|\bpropofol\b|\betomidate\b/i;

const POST_ASSESSMENT_PATTERNS: Record<ForeignBodySite, RegExp> = {
  skin: HEMOSTASIS_PATTERN,
  nose: HEMOSTASIS_PATTERN,
  eye: FLUORESCEIN_PATTERN,
  ear: TM_INTACT_PATTERN,
};

const LATERALIZABLE_SKIN_SITES: AnatomicSite[] = ['axilla', 'extremity', 'hand', 'foot'];

function branchForAnatomicSite(site: string): ForeignBodySite {
  return site === 'ear' ? 'ear' : site === 'nose' ? 'nose' : site === 'eyelid' ? 'eye' : 'skin';
}

function structuredSiteText(input: ProcedureFactsInput): string {
  return [input.bodySite, input.otherBodySite].filter(Boolean).join(' ');
}

function extractForeignBodySite(input: ProcedureFactsInput, text: string): FactValue<ForeignBodySite> | undefined {
  const structured = structuredSiteText(input);
  if (structured.trim().length > 0) {
    for (const [site, pattern] of BRANCH_PATTERNS) {
      if (pattern.test(structured)) return { value: site, evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }
    const normalized = normalizeAnatomicSite(structured);
    if (normalized !== undefined) {
      return { value: branchForAnatomicSite(normalized), evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }
  }
  for (const [site, pattern] of BRANCH_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) return { value: site, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
  }
  const textSite = extractSite(input, text);
  return textSite === undefined
    ? undefined
    : { value: branchForAnatomicSite(textSite.value), evidence: textSite.evidence };
}

function extractEyeStructure(input: ProcedureFactsInput, text: string): FactValue<EyeStructure> | undefined {
  const structured = structuredSiteText(input);
  if (structured.trim().length > 0) {
    for (const [structure, pattern] of EYE_STRUCTURE_PATTERNS) {
      if (pattern.test(structured)) return { value: structure, evidence: fieldEvidence(SITE_FIELD_LABEL) };
    }
  }

  const cornealWithoutSlitLamp = textMention(text, CORNEAL_WITHOUT_SLIT_LAMP_PATTERN);

  if (cornealWithoutSlitLamp !== undefined) return { value: 'cornea', evidence: cornealWithoutSlitLamp.evidence };

  for (const [structure, pattern] of EYE_STRUCTURE_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found)
      return { value: structure, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
  }

  return undefined;
}

function extractComplicationElements(text: string): FactValue<ForeignBodyComplicationElement>[] {
  const elements: FactValue<ForeignBodyComplicationElement>[] = [];

  for (const [element, pattern] of FOREIGN_BODY_COMPLICATION_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);

    if (found) {
      elements.push({ value: element, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) });
    }
  }
  return elements;
}

function extractGeneralAnesthesiaDocumented(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  const fromText = textFlag(text, GENERAL_ANESTHESIA_PATTERN);

  if (fromText) return fromText;

  if (input.medicationUsed && GENERAL_ANESTHESIA_PATTERN.test(input.medicationUsed)) {
    return { value: true, evidence: fieldEvidence(MEDICATION_FIELD_LABEL) };
  }

  return undefined;
}

export function extractForeignBodyFacts(input: ProcedureFactsInput): ForeignBodyFacts {
  const text = input.procedureDetails ?? '';
  const site = extractForeignBodySite(input, text);
  const anatomicSite = extractSite(input, text)?.value;
  const slitLampFromTechnique = (input.technique ?? []).some((value) => SLIT_LAMP_PATTERN.test(value));

  return {
    site,
    eyeStructure: site?.value === 'eye' ? extractEyeStructure(input, text) : undefined,
    incisionDocumented: textFlag(text, INCISION_PATTERN),
    complicationElements: extractComplicationElements(text),
    slitLampDocumented: slitLampFromTechnique
      ? { value: true, evidence: fieldEvidence(TECHNIQUE_FIELD_LABEL) }
      : textFlag(text, SLIT_LAMP_PATTERN),
    withoutSlitLampDocumented: textMention(text, WITHOUT_SLIT_LAMP_PATTERN),
    descriptionDocumented: textFlag(text, FOREIGN_BODY_DESCRIPTION_PATTERN),
    outcomeDocumented: textFlag(text, OUTCOME_PATTERN),
    postAssessmentDocumented: site !== undefined ? textFlag(text, POST_ASSESSMENT_PATTERNS[site.value]) : undefined,
    anesthesiaDocumented: extractAnesthesiaDocumented(input, text),
    generalAnesthesiaDocumented: extractGeneralAnesthesiaDocumented(input, text),
    sizeDocumented: lesionSizeDocumented(input, text),
    lateralityRequired:
      site !== undefined &&
      (site.value !== 'skin' || (anatomicSite !== undefined && LATERALIZABLE_SKIN_SITES.includes(anatomicSite))),
    lateralityDocumented: lateralityDocumented(input, text),
  };
}
