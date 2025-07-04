import { useQuery } from 'react-query';
import { OystehrAPIClient } from 'ui-components';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPastVisits = (apiClient: OystehrAPIClient | null, enabled = true, patientId?: string) =>
  useQuery(
    ['pastVisits', patientId],
    () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return patientId ? apiClient.getPastVisits({ patientId }) : apiClient.getPastVisits();
    },
    {
      enabled,
      onError: (err) => {
        console.error('Error during fetching appointments: ', err);
      },
      staleTime: 1000 * 60 * 5,
    }
  );
