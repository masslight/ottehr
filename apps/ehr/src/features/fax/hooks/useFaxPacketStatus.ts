import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetFaxPacketStatusOutput } from 'utils';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { fetchFaxPacketStatus } from '../api/faxApi';

export const FAX_PACKET_STATUS_QUERY_KEY = 'fax-packet-status';

/**
 * Polls the fax-packet Task while it is pending, mirroring the merge-patients pattern. Stops once the job
 * reaches a terminal state (`completed` / `failed`).
 */
export const useFaxPacketStatus = (taskId: string | undefined): UseQueryResult<GetFaxPacketStatusOutput> => {
  const apiClient = useOystehrAPIClient();

  return useQuery({
    queryKey: [FAX_PACKET_STATUS_QUERY_KEY, taskId],
    queryFn: () => fetchFaxPacketStatus(apiClient!, taskId!),
    enabled: Boolean(apiClient && taskId),
    refetchInterval: (query) => (query.state.data?.jobStatus === 'pending' ? 2000 : false),
    gcTime: 0,
  });
};
