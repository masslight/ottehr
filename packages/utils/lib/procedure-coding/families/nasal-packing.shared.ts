import { joinWithOr, TO_DETAILS, whereClauseFor } from '../family-support';
import { WhereToDocument } from '../model.types';
import {
  NASAL_PACKING_COMPLEXITY_ELEMENT_PATTERNS,
  NasalPackingComplexityElement,
  NasalPackingFacts,
  NasalPackingLocation,
} from './nasal-packing.extract';

export type { NasalPackingComplexityElement, NasalPackingFacts, NasalPackingLocation };

export const COMPLEXITY_ELEMENT_LABELS: Record<NasalPackingComplexityElement, string> = {
  'extensive-packing-or-cautery': 'extensive packing/cautery',
  'layered-packing': 'layered packing',
  'multiple-attempts': 'multiple attempts',
  'complex-language': 'complex control',
};

export const COMPLEXITY_ELEMENT_MENU = joinWithOr(
  NASAL_PACKING_COMPLEXITY_ELEMENT_PATTERNS.map(([element]) => COMPLEXITY_ELEMENT_LABELS[element])
);

export function complexityElementList(facts: NasalPackingFacts): string {
  return facts.complexityElements.map((element) => COMPLEXITY_ELEMENT_LABELS[element.value]).join(', ');
}

export const LOCATION_ASK_CLAUSE = 'the bleeding site selects the code branch (30901/30903 anterior; 30905 posterior)';

export const WHERE_TO_DOCUMENT = {
  location: { destination: TO_DETAILS, example: '"anterior epistaxis; anterior packing placed"' },
  complexityElement: { destination: TO_DETAILS, example: '"extensive layered packing after a second attempt"' },
  laterality: { destination: 'in the Side of body field' },
  method: { destination: TO_DETAILS, example: '"silver nitrate cautery, then Merocel packing placed"' },
  subsequent: {
    destination: TO_DETAILS,
    example: '"initial posterior packing this visit" or "posterior pack replaced today"',
  },
  hemostasis: { destination: TO_DETAILS, example: '"hemostasis achieved; no further bleeding"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export function subsequentPackingMessage(subject: string): string {
  return `${subject} — 30905 covers the initial posterior control, and the note documents a repeat or replacement posterior packing; a subsequent posterior packing is 30906, which is outside this model's scope and is not assessed. ${whereClause(
    'subsequent',
    'If this was the initial posterior packing, say so'
  )}`;
}
