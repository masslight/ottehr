import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { GetDocumentPacketPreviewOutput } from 'utils/lib/types/api/document-packet.types';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { DocumentPacketPreviewInput, fetchDocumentPacketPreview } from '../api/documentPacketApi';

export const DOCUMENT_PACKET_PREVIEW_QUERY_KEY = 'document-packet-preview';

export const useDocumentPacketPreview = (
  input: DocumentPacketPreviewInput | undefined,
  enabled: boolean
): UseQueryResult<GetDocumentPacketPreviewOutput> => {
  const apiClient = useOystehrAPIClient();

  return useQuery({
    queryKey: [DOCUMENT_PACKET_PREVIEW_QUERY_KEY, input?.appointmentId, input?.referralId],
    queryFn: () => fetchDocumentPacketPreview(apiClient!, input!),
    enabled: Boolean(apiClient && input && enabled),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
};
