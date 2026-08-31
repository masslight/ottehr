import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components/lib/data/oystehrApi';
import { useSuccessQuery } from 'utils/lib/frontend';
import { PromiseReturnType } from 'utils/lib/types/common';

export const useGetPatients = (
  apiClient: OystehrAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPatients']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPatients']>>> => {
  const queryResult = useQuery({
    queryKey: ['patients'],

    queryFn: () => {
      if (apiClient) {
        return apiClient.getPatients();
      }
      throw new Error('api client not defined');
    },

    // todo: why is this disabled?
    enabled: false,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
