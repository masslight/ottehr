import { useQuery } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';
import { PromiseReturnType } from 'ottehr-utils';

export const useGetPatients = (
  apiClient: ZapEHRAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getPatients']>>) => void,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  console.log(100);
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
    },
  );
};
