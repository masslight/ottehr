import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';
import { useAppointmentStore } from '../appointments';

export const useJoinCall = (
  apiClient: OystehrAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['joinCall']>>) => void,
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

  useEffect(() => {
    if (queryResult.data && onSuccess) {
      onSuccess(queryResult.data);
    }
  }, [queryResult.data, onSuccess]);

  useEffect(() => {
    if (queryResult.error && onError) {
      onError(queryResult.error);
    }
  }, [queryResult.error, onError]);

  return queryResult;
};
