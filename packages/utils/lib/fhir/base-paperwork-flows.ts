import { IN_PERSON_INTAKE_PAPERWORK_URL } from '../ottehr-config/intake-paperwork';
import { LITE_INTAKE_PAPERWORK_URL } from '../ottehr-config/intake-paperwork-lite';
import { VIRTUAL_INTAKE_PAPERWORK_URL } from '../ottehr-config/intake-paperwork-virtual';
import { PaperworkFlowBase } from './constants';

// Catalog of the three fixed *base* paperwork flows — one per base intake canonical.
// Their forms compose onto every booking that resolves to that canonical (OTR-2309 v2).
// Kept out of paperwork-flow.ts so the base-canonical config imports don't land in the
// broadly-imported flow record module / EHR main bundle.

export interface BasePaperworkFlowDescriptor {
  /** Base intake canonical URL this base flow binds to. */
  canonical: string;
  /** Reserved, stable List.identifier slug. */
  slug: string;
  /** Display name shown on the Paperwork Flows admin page. */
  title: string;
  /** Mirrors PaperworkFlowBase for the List's base extension (in-person/virtual = standard). */
  base: PaperworkFlowBase;
}

export const BASE_PAPERWORK_FLOWS: BasePaperworkFlowDescriptor[] = [
  {
    canonical: IN_PERSON_INTAKE_PAPERWORK_URL,
    slug: 'base-standard-in-person',
    title: 'In-person intake',
    base: 'standard',
  },
  { canonical: VIRTUAL_INTAKE_PAPERWORK_URL, slug: 'base-standard-virtual', title: 'Virtual intake', base: 'standard' },
  { canonical: LITE_INTAKE_PAPERWORK_URL, slug: 'base-consent-only', title: 'Consent only', base: 'consent-only' },
];

/** The base-flow descriptor for a resolved intake canonical, or undefined. */
export function baseFlowForCanonical(canonical: string | undefined): BasePaperworkFlowDescriptor | undefined {
  if (!canonical) return undefined;
  return BASE_PAPERWORK_FLOWS.find((b) => b.canonical === canonical);
}
