import { useQueries } from '@tanstack/react-query';
import { GetFaxPacketStatusOutput } from 'utils/lib/types/api/fax.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { fetchFaxPacketStatus } from '../api/faxApi';
import { nextFaxPollInterval } from '../model/faxPolling';

export const FAX_PACKET_STATUS_QUERY_KEY = 'fax-packet-status';

export interface FaxPacketStatusResult {
  taskId: string;
  data?: GetFaxPacketStatusOutput;
}

/**
 * Polls every in-flight fax-packet Task independently, mirroring the merge-patients async pattern. Because
 * each send is its own backend Task, a provider can queue several for the same visit (send, close, send
 * again) without one abandoning another — each id gets its own query, keyed by task id so React Query
 * dedupes and pauses it while the tab is unfocused.
 *
 * Each poll follows the shared backoff schedule and stops once its Task reaches a terminal state or the
 * schedule is exhausted; the overall timeout is enforced by the caller (see `useSendFax`).
 */
export const useFaxPacketStatuses = (taskIds: string[]): FaxPacketStatusResult[] => {
  const apiClient = useOystehrAPIClient();

  return useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: [FAX_PACKET_STATUS_QUERY_KEY, taskId],
      queryFn: () => fetchFaxPacketStatus(apiClient!, taskId),
      enabled: Boolean(apiClient),
      refetchInterval: (query: { state: { data?: GetFaxPacketStatusOutput; dataUpdateCount: number } }) => {
        if (query.state.data && query.state.data.jobStatus !== 'pending') return false;
        return nextFaxPollInterval(query.state.dataUpdateCount);
      },
      gcTime: 0,
    })),
    combine: (results) => results.map((result, index) => ({ taskId: taskIds[index], data: result.data })),
  });
};
