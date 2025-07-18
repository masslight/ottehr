import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';

export const useGetPatients = (
  apiClient: OystehrAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPatients']>>) => void
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

  useEffect(() => {
    if (queryResult.data && onSuccess) {
      onSuccess(queryResult.data);
    }
  }, [queryResult.data, onSuccess]);

  return queryResult;
};
