import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useOystehrAPIClient } from '../../visits/shared/hooks/useOystehrAPIClient';
import { fetchFaxSenderFaxNumber } from '../api/faxApi';

export const FAX_SENDER_QUERY_KEY = 'fax-sender';

/**
 * The number every outbound fax is sent from. One environment-level value shared by all Send Fax
 * dialogs, so it lives under its own key and is kept for the session instead of being refetched per
 * visit. `null` means the sending organization has no fax number on file.
 */
export const useFaxSenderFaxNumber = (enabled: boolean): UseQueryResult<string | null> => {
  const apiClient = useOystehrAPIClient();

  return useQuery({
    queryKey: [FAX_SENDER_QUERY_KEY],
    queryFn: () => fetchFaxSenderFaxNumber(apiClient!),
    enabled: Boolean(apiClient && enabled),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
};
