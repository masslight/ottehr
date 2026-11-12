import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetDocumentPacketPreviewOutput } from 'utils/lib/types/api/document-packet.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { fetchDocumentPacketPreview } from '../api/documentPacketApi';

export const DOCUMENT_PACKET_PREVIEW_QUERY_KEY = 'document-packet-preview';

export const useDocumentPacketPreview = (
  appointmentId: string | undefined,
  enabled: boolean
): UseQueryResult<GetDocumentPacketPreviewOutput> => {
  const apiClient = useOystehrAPIClient();

  return useQuery({
    queryKey: [DOCUMENT_PACKET_PREVIEW_QUERY_KEY, appointmentId],
    queryFn: () => fetchDocumentPacketPreview(apiClient!, appointmentId!),
    enabled: Boolean(apiClient && appointmentId && enabled),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
};
