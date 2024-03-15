import { useMutation, useQuery } from 'react-query';
import { useAppointmentStore } from '../appointments/appointment.store';
import { ZapEHRAPIClient } from 'ottehr-components';
import { FileURLs, PromiseReturnType } from 'ottehr-utils';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPaperwork = (
  apiClient: ZapEHRAPIClient | null,
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getPaperwork']>>) => void,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) =>
  useQuery(
    ['paperwork'],
    () => {
      const appointment = useAppointmentStore.getState();

      if (apiClient && appointment.appointmentID) {
        return apiClient.getPaperwork({
          appointmentID: appointment.appointmentID,
        });
      }

      throw new Error('api client not defined or appointmentID is not provided');
    },
    {
      enabled: false,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get paperwork: ', err);
      },
    },
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdatePaperworkMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentID,
      paperwork,
      files,
    }: {
      apiClient: ZapEHRAPIClient;
      appointmentID: string;
      paperwork: any;
      files?: FileURLs;
    }) => {
      return apiClient.updatePaperwork({
        appointmentID: appointmentID,
        paperwork,
        files,
      });
    },
  });
