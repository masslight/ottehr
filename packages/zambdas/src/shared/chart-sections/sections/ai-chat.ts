import { Practitioner } from 'fhir/r4b';
import {
  AMBIENT_SCRIBE_RECORDING_PENDING_CODING,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
} from 'utils/lib/fhir/constants';
import { VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE } from 'utils/lib/types/api/appointment.types';
import { AI_OBSERVATION_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { encounterScopedSearch } from '../../chart-data/search-requests';
import { mapChartResources } from '../map';
import { ChartSectionDefinition } from '../types';

/** The AI consult-note documents, the pending-recording marker, and the AI suggestion Observations. */
export const aiChatSection: ChartSectionDefinition<'aiChat'> = {
  section: 'aiChat',
  requests: (encounterId) => [
    encounterScopedSearch('DocumentReference', encounterId, {
      type: `${VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.code},${AMBIENT_SCRIBE_RECORDING_PENDING_CODING.code}`,
    }),
    encounterScopedSearch('Observation', encounterId, {
      _tag: `${PRIVATE_EXTENSION_BASE_URL}/${AI_OBSERVATION_META_SYSTEM}|`,
    }),
  ],
  build: async ({ encounter, encounterId, oystehr }, resources) => {
    const mapped = mapChartResources(encounter, resources, encounterId, {
      aiChat: { documents: [], providers: [] },
      observations: [],
    });
    const aiChat = mapped.aiChat ?? { documents: [], providers: [] };

    const practitionerIds = aiChat.documents
      .map(
        (document) =>
          document.extension
            ?.find((extension) => extension.url === `${PUBLIC_EXTENSION_BASE_URL}/provider`)
            ?.valueReference?.reference?.split('/')[1]
      )
      .filter((practitionerId): practitionerId is string => practitionerId != null);
    if (practitionerIds.length > 0) {
      aiChat.providers = (
        await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_id', value: [...new Set(practitionerIds)].join(',') }],
        })
      ).unbundle();
    }

    return { aiChat, observations: mapped.observations ?? [] };
  },
};
