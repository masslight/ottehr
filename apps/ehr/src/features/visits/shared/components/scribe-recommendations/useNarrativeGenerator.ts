import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { invalidateChartSections } from '../../hooks/chartSectionCache';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { NarrativeGenerator } from './scribeRecommendations.store';

/**
 * Calls the Easy Chart narrative endpoint: provider-voice lines, each with the transcript snippets the server
 * verified it against. Used only when the document has no stored narrative; the server stores the result on it.
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
      // Refetch aiChat so re-picking the document reads the stored narrative instead of regenerating. Not awaited.
      if (documentId) void invalidateChartSections(queryClient, encounterId, ['aiChat']);
      return response.lines;
    },
    [apiClient, queryClient, encounterId]
  );
};
