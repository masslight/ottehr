import { useQuery } from 'react-query';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';
import { useAppointmentStore } from '../appointments';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useJoinCall = (
  apiClient: OystehrAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrAPIClient['joinCall']>>) => void,
  onError: (error: any) => void
) => {
  return useQuery(
    ['join-call', apiClient],
    () => {
      const { appointmentID } = useAppointmentStore.getState();

      if (apiClient && appointmentID) {
        return apiClient.joinCall({ appointmentId: appointmentID });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
    {
      onSuccess,
      onError,
    }
  );
};
