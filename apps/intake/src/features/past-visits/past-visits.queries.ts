import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';

export const useGetPastVisits = (
  apiClient: OystehrAPIClient | null,
  enabled = true,
  patientId?: string
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPastVisits']>>, Error> => {
  const query = useQuery({
    queryKey: ['pastVisits', patientId],
    queryFn: () => {
      if (!apiClient) {
        throw new Error('API client not defined');
      }
      return patientId ? apiClient.getPastVisits({ patientId }) : apiClient.getPastVisits();
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  return query;
};
