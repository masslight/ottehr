import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { Encounter, FhirResource } from 'fhir/r4b';
import {
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';

export interface ChartClient {
  oystehr: Oystehr;
  m2mToken: string;
}

/** What a section builder gets besides the resources its own searches returned. */
export interface SectionContext extends ChartClient {
  encounterId: string;
  patientId: string;
  encounter: Encounter;
}

/**
 * A chart section: the FHIR searches that feed it, all built from the encounter id alone, and the DTO
 * mapping over what those searches returned. The searches are the access boundary of the read path,
 * so a section never takes search parameters from the caller; `params` is a small enumerated option
 * set (which note types, a page size) and nothing else.
 */
export interface ChartSectionDefinition<S extends ChartSection> {
  section: S;
  requests: (encounterId: string, params: ChartSectionParams<S>) => BatchInputGetRequest[];
  build: (
    context: SectionContext,
    resources: FhirResource[],
    params: ChartSectionParams<S>
  ) => Promise<ChartSectionData<S>>;
}
