import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { useChartFields } from './useChartFields';

/**
 * The one chart-fields query behind the Review & Sign and follow-up note pages.
 *
 * Every section summary on those pages reads from this query instead of requesting its own fields.
 *
 * Keep `progressNoteChartDataRequestedFields` a superset of what the summaries need.
 */
export const useProgressNoteChartFields = (): ReturnType<
  typeof useChartFields<typeof progressNoteChartDataRequestedFields>
> => useChartFields({ requestedFields: progressNoteChartDataRequestedFields });
