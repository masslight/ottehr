import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetFaxPacketPreviewOutput } from 'utils';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { fetchFaxPacketPreview } from '../api/faxApi';

export const FAX_PACKET_PREVIEW_QUERY_KEY = 'fax-packet-preview';

export const useFaxPacketPreview = (
  appointmentId: string | undefined,
  enabled: boolean
): UseQueryResult<GetFaxPacketPreviewOutput> => {
  const apiClient = useOystehrAPIClient();

  return useQuery({
    queryKey: [FAX_PACKET_PREVIEW_QUERY_KEY, appointmentId],
    queryFn: () => fetchFaxPacketPreview(apiClient!, appointmentId!),
    enabled: Boolean(apiClient && appointmentId && enabled),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
};
