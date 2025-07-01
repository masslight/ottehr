import { useQuery, UseQueryResult } from 'react-query';
import { ZapEHRAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';

export const useGetPatients = (
  apiClient: ZapEHRAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getPatients']>>) => void
): UseQueryResult<PromiseReturnType<ReturnType<ZapEHRAPIClient['getPatients']>>, unknown> => {
  return useQuery(
    ['patients'],
    () => {
      if (apiClient) {
        return apiClient.getPatients();
      }
      throw new Error('api client not defined');
    },
    {
      enabled: false,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get patients: ', err);
      },
    }
  );
};
