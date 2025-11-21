import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { useErrorQuery, useSuccessQuery } from 'utils';
import { PromiseReturnType } from 'utils';
import { useAppointmentStore } from '../appointments';

export const useJoinCall = (
  apiClient: OystehrAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['joinCall']>> | null) => void,
  onError: (error: unknown) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['joinCall']>>> => {
  const queryResult = useQuery({
    queryKey: ['join-call', apiClient],

    queryFn: () => {
      const { appointmentID } = useAppointmentStore.getState();

      if (apiClient && appointmentID) {
        return apiClient.joinCall({ appointmentId: appointmentID });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
  });

  useSuccessQuery(queryResult.data, onSuccess);
  useErrorQuery(queryResult.error, onError);

  return queryResult;
};
