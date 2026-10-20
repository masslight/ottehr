import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import {
  EXAM_OBSERVATION_META_SYSTEM,
  ROS_OBSERVATION_META_SYSTEM,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { encounterScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/** The examination and review-of-systems Observations of this visit. */
export const examSection: ChartSectionDefinition<'exam'> = {
  section: 'exam',
  requests: (encounterId) => [
    encounterScopedSearch('Observation', encounterId, {
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${EXAM_OBSERVATION_META_SYSTEM}|,${PRIVATE_EXTENSION_BASE_URL}/${ROS_OBSERVATION_META_SYSTEM}|`,
    }),
  ],
  build: async ({ encounter, encounterId }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, { examObservations: [], rosObservations: [] });
    return { examObservations: mapped.examObservations ?? [], rosObservations: mapped.rosObservations ?? [] };
  },
};
