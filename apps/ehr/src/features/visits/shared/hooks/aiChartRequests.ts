import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { AI_OBSERVATION_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChartDataRequestedFields } from 'utils/lib/types/api/chart-data/get-chart-data.types';

/** Narrow get-chart-data requests for the two AI polling loops; each costs two FHIR searches. */

/** The AI consult-note documents and the pending-recording marker. */
export const AI_CHAT_REQUESTED_FIELDS: ChartDataRequestedFields = { aiChat: {} };

/** The AI suggestion Observations only: the tag system alone matches every AI observation field. */
export const AI_SUGGESTIONS_REQUESTED_FIELDS: ChartDataRequestedFields = {
  observations: { _search_by: 'encounter', _tag: `${PRIVATE_EXTENSION_BASE_URL}/${AI_OBSERVATION_META_SYSTEM}|` },
};
