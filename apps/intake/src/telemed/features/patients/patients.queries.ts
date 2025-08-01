import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { useSuccessQuery } from 'utils';
import { PromiseReturnType } from 'utils';

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

    enabled: false,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
