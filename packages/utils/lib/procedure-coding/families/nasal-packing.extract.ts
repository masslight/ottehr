import {
  firstMatch,
  HEMOSTASIS_PATTERN,
  lateralityDocumented,
  snippetAround,
  suppliesContain,
  textFlag,
} from '../extract';
import { SUPPLIES_FIELD_LABEL } from '../family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from '../model.types';

export type NasalPackingLocation = 'anterior' | 'posterior';

export type NasalPackingComplexityElement =
  | 'extensive-packing-or-cautery'
  | 'layered-packing'
  | 'multiple-attempts'
  | 'complex-language';

export interface NasalPackingFacts {
  location?: FactValue<NasalPackingLocation>;
  complexityElements: FactValue<NasalPackingComplexityElement>[];
  cauteryDocumented?: FactValue<true>;
  packingDocumented?: FactValue<true>;
  subsequentPackingDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
  hemostasisDocumented?: FactValue<true>;
}

const CONTROL_OR_BLEED_SOURCE = String.raw`pack\w*|balloon\w*|tampon\w*|foley|cauter\w*|bleed\w*|h[ae]morrhag\w*|epistaxis|nose\s*bleeds?`;
const POSTERIOR_EXAM_NOUNS_SOURCE = String.raw`pharyn\w*|oropharyn\w*|nasopharyn\w*|walls?|aspects?|drainage|drip`;

const POSTERIOR_PATTERN = new RegExp(
  [
    String.raw`\bposterior(?:ly)?\s+(?!(?:${POSTERIOR_EXAM_NOUNS_SOURCE})\b)(?:nasal\s+|nasopharyngeal\s+)?(?:${CONTROL_OR_BLEED_SOURCE})`,
    String.raw`(?:${CONTROL_OR_BLEED_SOURCE})(?:(?!\b(?:${POSTERIOR_EXAM_NOUNS_SOURCE})\b)[^.;\n]){0,24}\bposterior(?:ly)?\b(?!\s+(?:${POSTERIOR_EXAM_NOUNS_SOURCE})\b)`,
  ].join('|'),
  'i'
);

const ANTERIOR_PATTERN = new RegExp(
  [
    String.raw`\banterior(?:ly)?\s+(?:nasal\s+)?(?:${CONTROL_OR_BLEED_SOURCE})`,
    String.raw`(?:${CONTROL_OR_BLEED_SOURCE})[^.;\n]{0,24}\banterior(?:ly)?\b`,
  ].join('|'),
  'i'
);

const PLANNED_MODALITY_SOURCE = String.raw`to|will|would|may|might|should|shall|can|could|plan|plans|planned|planning|consider|recommend|recommended`;
const PERFORMED_REPACKING_SOURCE = String.raw`(?<!\b(?:${PLANNED_MODALITY_SOURCE})\s(?:be\s|been\s|need\s|needs\s|needed\s|to\s)?)(?:re-?pack(?:ed|ing)|repack)\b(?!\s*(?:in\b|if\b|prn\b|as\s+needed|tomorrow|next\b|q\d))`;

export const NASAL_PACKING_COMPLEXITY_ELEMENT_PATTERNS: Array<[NasalPackingComplexityElement, RegExp]> = [
  [
    'extensive-packing-or-cautery',
    /extensive(?:ly)?\s+(?:pack\w*|cauter\w*)|(?:pack\w*|cauter\w*)[^.;\n]{0,20}\bextensive/i,
  ],
  ['layered-packing', /layered\s+pack\w*|multiple\s+layers[^.;\n]{0,20}\bpack\w*|pack\w*[^.;\n]{0,20}\bin\s+layers\b/i],
  [
    'multiple-attempts',
    new RegExp(
      [String.raw`multiple\s+attempts`, String.raw`second\s+attempt`, PERFORMED_REPACKING_SOURCE].join('|'),
      'i'
    ),
  ],
  [
    'complex-language',
    /complex\s+(?:(?:nasal\s+|anterior\s+|epistaxis\s+)?(?:pack\w*|cauter\w*|control|hemostasis|h[ae]morrhage\s+control))|(?:pack\w*|cauter\w*|control)\s+(?:was\s+|were\s+|is\s+)?complex\b/i,
  ],
];

const CAUTERY_PATTERN = /cauter\w*|silver\s+nitrate/i;

const PACKING_PATTERN =
  /\bpack(?:ed|ing|s)?\b|merocel|rapid\s*rhino|rhino\s*rocket|nasal\s+tampon|surgicel|(?:vaseline|petrolatum|petroleum)\s+gauze/i;

const PACKING_SUPPLY_PATTERN = /merocel|rapid\s*rhino|rhino\s*rocket|nasal\s+tampon|packing|surgicel/i;

const SUBSEQUENT_PACKING_PATTERN =
  /(?:subsequent|repeat|repeated|replacement)\s+(?:posterior\s+)?(?:nasal\s+)?pack\w*|(?:posterior\s+)?pack\w*[^.;\n]{0,16}?\b(?:replaced|changed|exchanged)\b/i;

const NARIS_LATERALITY_PATTERN =
  /\b(?:left|right|bilateral)\b[^.;,\n]{0,12}\b(?:naris|nares|nostril)s?\b|\b(?:naris|nares|nostril)s?\b[^.;,\n]{0,12}\b(?:left|right)\b/i;

export function extractNasalPackingFacts(input: ProcedureFactsInput): NasalPackingFacts {
  const text = input.procedureDetails ?? '';
  let location: FactValue<NasalPackingLocation> | undefined;
  const posterior = firstMatch(text, POSTERIOR_PATTERN);
  const anterior = firstMatch(text, ANTERIOR_PATTERN);

  if (posterior) {
    location = {
      value: 'posterior',
      evidence: textEvidence(snippetAround(text, posterior.index, posterior.match.length)),
    };
  } else if (anterior) {
    location = {
      value: 'anterior',
      evidence: textEvidence(snippetAround(text, anterior.index, anterior.match.length)),
    };
  }

  const complexityElements: FactValue<NasalPackingComplexityElement>[] = [];

  for (const [element, pattern] of NASAL_PACKING_COMPLEXITY_ELEMENT_PATTERNS) {
    const found = firstMatch(text, pattern);

    if (found) {
      complexityElements.push({
        value: element,
        evidence: textEvidence(snippetAround(text, found.index, found.match.length)),
      });
    }
  }

  let packingDocumented = textFlag(text, PACKING_PATTERN);

  if (!packingDocumented && suppliesContain(input, PACKING_SUPPLY_PATTERN)) {
    packingDocumented = { value: true, evidence: fieldEvidence(SUPPLIES_FIELD_LABEL) };
  }

  return {
    location,
    complexityElements,
    cauteryDocumented: textFlag(text, CAUTERY_PATTERN),
    packingDocumented,
    subsequentPackingDocumented: textFlag(text, SUBSEQUENT_PACKING_PATTERN),
    lateralityDocumented: lateralityDocumented(input, text, NARIS_LATERALITY_PATTERN),
    hemostasisDocumented: textFlag(text, HEMOSTASIS_PATTERN),
  };
}
