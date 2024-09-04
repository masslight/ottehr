import { useQuery } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetProviders = (apiClient: ZapEHRAPIClient | null, enabled = false) =>
  useQuery(
    ['providers'],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      console.log('getting providers');
      return apiClient.getProviders();
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching providers: ', err);
      },
    },
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetLocations = (apiClient: ZapEHRAPIClient | null, enabled = false) =>
  useQuery(
    ['locations'],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return apiClient.getLocations();
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching locations: ', err);
      },
    },
  );
