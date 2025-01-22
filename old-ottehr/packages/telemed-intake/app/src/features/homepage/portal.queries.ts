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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetGroups = (apiClient: ZapEHRAPIClient | null, enabled = false) =>
  useQuery(
    ['groups'],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return apiClient.getGroups();
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching groups: ', err);
      },
    },
  );
