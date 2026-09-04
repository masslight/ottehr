import { joinWithOr, TO_DETAILS, whereClauseFor } from '../family-support';
import { WhereToDocument } from '../model.types';
import {
  INCISION_DRAINAGE_COMPLEXITY_ELEMENT_PATTERNS,
  IncisionDrainageComplexityElement,
  IncisionDrainageFacts,
  IncisionDrainageOutOfScopeSite,
} from './incision-drainage.extract';
import { OUT_OF_SCOPE_SITE_CODING } from './incision-drainage.rules';

export type { IncisionDrainageComplexityElement, IncisionDrainageFacts, IncisionDrainageOutOfScopeSite };

export const COMPLEXITY_ELEMENT_LABELS: Record<IncisionDrainageComplexityElement, string> = {
  'loculations-dissection': 'blunt dissection of loculations',
  probing: 'probing of the abscess cavity',
  packing: 'packing placed',
  'drain-placement': 'drain placement',
  'multiple-abscesses': 'multiple abscesses',
};

export const COMPLEXITY_ELEMENT_MENU = joinWithOr(
  INCISION_DRAINAGE_COMPLEXITY_ELEMENT_PATTERNS.map(([element]) => COMPLEXITY_ELEMENT_LABELS[element])
);

export function complexityElementList(facts: IncisionDrainageFacts): string {
  return facts.complexityElements.map((element) => COMPLEXITY_ELEMENT_LABELS[element.value]).join(', ');
}

export const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  procedure: {
    destination: TO_DETAILS,
    example: '"#11 blade stab incision at the point of maximal fluctuance; ~5 mL purulent drainage expressed"',
  },
  incision: { destination: TO_DETAILS, example: '"#11 blade stab incision at the point of maximal fluctuance"' },
  drainage: { destination: TO_DETAILS, example: '"~5 mL purulent drainage expressed"' },
  complexityElement: {
    destination: TO_DETAILS,
    example: '"loculations broken up by blunt dissection; iodoform packing placed"',
  },
  size: { destination: 'in the Wound/lesion size (cm) field' },
  anesthesia: {
    destination: 'in the Anaesthesia / medication used field',
    example: '"2 mL 1% lidocaine with epinephrine"',
  },
  culture: { destination: 'in the Specimen sent field' },
  dressing: { destination: TO_DETAILS, example: '"dry dressing applied; procedure tolerated well"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export function outOfScopeSiteMessage(site: IncisionDrainageOutOfScopeSite, subject: string): string {
  const { label, codes } = OUT_OF_SCOPE_SITE_CODING[site];
  return `${subject} — the note documents ${label}, and 10060/10061 cover incision and drainage of a cutaneous abscess. That drainage is ${codes}, which is outside this model's scope and is not assessed.`;
}
