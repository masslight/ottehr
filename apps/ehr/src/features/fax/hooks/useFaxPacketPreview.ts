import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetFaxPacketPreviewOutput } from 'utils/lib/types/api/fax.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { FaxPacketPreviewInput, fetchFaxPacketPreview } from '../api/faxApi';

export const FAX_PACKET_PREVIEW_QUERY_KEY = 'fax-packet-preview';

export const useFaxPacketPreview = (
  input: FaxPacketPreviewInput | undefined,
  enabled: boolean
): UseQueryResult<GetFaxPacketPreviewOutput> => {
  const apiClient = useOystehrAPIClient();

  return useQuery({
    queryKey: [FAX_PACKET_PREVIEW_QUERY_KEY, input?.appointmentId, input?.referralId],
    queryFn: () => fetchFaxPacketPreview(apiClient!, input!),
    enabled: Boolean(apiClient && input && enabled),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
};
