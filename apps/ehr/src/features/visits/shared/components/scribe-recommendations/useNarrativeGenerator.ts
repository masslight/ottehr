import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { CHART_DATA_QUERY_KEY } from 'src/constants';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { NarrativeGenerator } from './scribeRecommendations.store';

/**
 * The step before the plan: the Easy Chart narrative endpoint reads a transcript and writes it back as
 * provider-voice lines, each carrying the transcript snippets the server verified it against (none, when
 * the generator said it on its own). The lines come to the editor, where the provider corrects them, and
 * only then does the planner read them.
 *
 * Only called for a transcript with no stored narrative: the recording pipeline stamps one on each
 * transcript document as it transcribes, and the store reads that first. When the transcript came from a
 * document, the endpoint stamps its result onto that document too, so the transcript costs one generation ever.
 */
export const useNarrativeGenerator = (): NarrativeGenerator => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;

  return useCallback(
    async (transcript: string, documentId?: string) => {
      if (!apiClient || !encounterId) throw new Error('The visit is still loading. Please try again.');
      const response = await apiClient.easyChartNarrative({ transcript, encounterId, documentId });
      // The document in chart data now carries the stored narrative; refetch so a re-pick reads it rather than
      // generating again. Not awaited: the lines are ready, and the refetch is bookkeeping.
      if (documentId) void queryClient.invalidateQueries({ queryKey: [CHART_DATA_QUERY_KEY, encounterId] });
      return response.lines;
    },
    [apiClient, queryClient, encounterId]
  );
};
