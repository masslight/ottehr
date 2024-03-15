import { useMutation, useQuery } from 'react-query';
import { PromiseReturnType, ZapEHRTelemedAPIClient } from '../../data';
import { GetAppointmentsRequestParams } from '../../utils';
import { InitTelemedSessionRequestParams } from 'ehr-utils';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetTelemedAppointments = (
  {
    apiClient,
    stateFilter,
    dateFilter = '2023-02-13T13:00:00.000-05:00',
    patientFilter,
    statusesFilter,
  }: {
    apiClient: ZapEHRTelemedAPIClient | null;
  } & GetAppointmentsRequestParams,
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRTelemedAPIClient['getTelemedAppointments']>>) => void,
): any => {
  return useQuery(
    ['telemed-appointments', { apiClient, stateFilter, dateFilter, patientFilter, statusesFilter }],
    () => {
      if (apiClient) {
        return apiClient.getTelemedAppointments({
          stateFilter,
          dateFilter,
          patientFilter,
          statusesFilter,
        });
      }
      throw new Error('api client not defined');
    },
    {
      refetchInterval: 10000,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointments: ', err);
      },
    },
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetUser = (
  {
    apiClient,
    userId,
  }: {
    apiClient: ZapEHRTelemedAPIClient | null;
    userId?: string;
  },
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRTelemedAPIClient['getUser']>>) => void,
): any => {
  return useQuery(
    ['telemed-appointments', { apiClient }],
    () => {
      if (apiClient && userId) {
        return apiClient.getUser({ userId });
      }
      throw new Error('api client not defined or userId not provided');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get telemed appointments: ', err);
      },
    },
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInitTelemedSessionMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentId,
      userId,
    }: {
      apiClient: ZapEHRTelemedAPIClient;
    } & InitTelemedSessionRequestParams) => {
      return apiClient.initTelemedSession({
        appointmentId,
        userId,
      });
    },
  });
