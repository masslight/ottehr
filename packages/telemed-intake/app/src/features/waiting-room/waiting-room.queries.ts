import { useQuery } from 'react-query';
import { ZapEHRAPIClient } from 'ottehr-components';
import { PromiseReturnType } from 'ottehr-utils';
import { useAppointmentStore } from '../appointments';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetWaitStatus = (
  apiClient: ZapEHRAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getWaitStatus']>>) => void,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  return useQuery(
    ['waiting-room', apiClient],
    () => {
      const appointment = useAppointmentStore.getState();

      if (apiClient && appointment.appointmentID) {
        return apiClient.getWaitStatus({ appointmentID: appointment.appointmentID });
      }

      throw new Error('api client not defined or appointmentID not provided');
    },
    {
      refetchInterval: 10000,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get waiting room: ', err);
      },
    },
  );
};
