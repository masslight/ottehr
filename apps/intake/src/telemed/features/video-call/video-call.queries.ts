import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';
import { useErrorQuery, useSuccessQuery } from 'utils/lib/frontend';

export const useJoinCall = (
  apiClient: OystehrAPIClient | null,
  appointmentId: string | undefined,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['joinCall']>> | null) => void,
  onError: (error: unknown) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['joinCall']>>> => {
  const queryResult = useQuery({
    queryKey: ['join-call', appointmentId, apiClient],

    queryFn: () => {
      if (apiClient && appointmentId) {
        return apiClient.joinCall({ appointmentId });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
    enabled: isJoinCallEnabled(apiClient, appointmentId),
  });

  useSuccessQuery(queryResult.data, onSuccess);
  useErrorQuery(queryResult.error, onError);

  return queryResult;
};

export function isJoinCallEnabled(apiClient: OystehrAPIClient | null, appointmentId: string | undefined): boolean {
  return Boolean(apiClient && appointmentId);
}
