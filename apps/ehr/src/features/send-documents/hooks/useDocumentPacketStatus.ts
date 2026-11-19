import { useQueries } from '@tanstack/react-query';
import { GetDocumentPacketStatusOutput } from 'utils/lib/types/api/document-packet.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { fetchDocumentPacketStatus } from '../api/documentPacketApi';
import { nextPacketStatusPollInterval } from '../model/polling';

export const DOCUMENT_PACKET_STATUS_QUERY_KEY = 'document-packet-status';

export interface DocumentPacketStatusResult {
  taskId: string;
  data?: GetDocumentPacketStatusOutput;
}

/**
 * Polls every in-flight document-packet Task independently, mirroring the merge-patients async pattern. Because
 * each send is its own backend Task, a provider can queue several for the same visit (send, close, send
 * again) without one abandoning another — each id gets its own query, keyed by task id so React Query
 * dedupes and pauses it while the tab is unfocused.
 *
 * Each poll follows the shared backoff schedule and stops once its Task reaches a terminal state or the
 * schedule is exhausted; the overall timeout is enforced by the caller (see `useSendDocuments`).
 */
export const useDocumentPacketStatuses = (taskIds: string[]): DocumentPacketStatusResult[] => {
  const apiClient = useOystehrAPIClient();

  return useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: [DOCUMENT_PACKET_STATUS_QUERY_KEY, taskId],
      queryFn: () => fetchDocumentPacketStatus(apiClient!, taskId),
      enabled: Boolean(apiClient),
      refetchInterval: (query: { state: { data?: GetDocumentPacketStatusOutput; dataUpdateCount: number } }) => {
        if (query.state.data && query.state.data.jobStatus !== 'pending') return false;
        return nextPacketStatusPollInterval(query.state.dataUpdateCount);
      },
      gcTime: 0,
    })),
    combine: (results) => results.map((result, index) => ({ taskId: taskIds[index], data: result.data })),
  });
};
