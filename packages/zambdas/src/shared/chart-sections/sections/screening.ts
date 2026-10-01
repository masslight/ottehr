import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { encounterScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/** The screening (additional questions) Observations of this visit. */
export const screeningSection: ChartSectionDefinition<'screening'> = {
  section: 'screening',
  requests: (encounterId) => [
    encounterScopedSearch('Observation', encounterId, {
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${ADDITIONAL_QUESTIONS_META_SYSTEM}|`,
    }),
  ],
  build: async ({ encounter, encounterId }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, { observations: [] });
    return { observations: mapped.observations ?? [] };
  },
};
