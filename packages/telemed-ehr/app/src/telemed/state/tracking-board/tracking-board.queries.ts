import { Patient } from 'fhir/r4';
import { useMutation, useQuery } from 'react-query';
import { ChangeTelemedAppointmentStatusInput, InitTelemedSessionRequestParams } from 'ehr-utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { PromiseReturnType, ZapEHRTelemedAPIClient } from '../../data';
import { GetAppointmentsRequestParams } from '../../utils';

export const useGetTelemedAppointments = (
  {
    apiClient,
    usStatesFilter,
    dateFilter,
    patientFilter,
    statusesFilter,
  }: {
    apiClient: ZapEHRTelemedAPIClient | null;
  } & GetAppointmentsRequestParams,
  onSuccess: (data: PromiseReturnType<ReturnType<ZapEHRTelemedAPIClient['getTelemedAppointments']>>) => void,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  return useQuery(
    ['telemed-appointments', { apiClient, usStatesFilter, dateFilter, patientFilter, statusesFilter }],
    () => {
      if (apiClient) {
        return apiClient.getTelemedAppointments({
          usStatesFilter,
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useChangeTelemedAppointmentStatusMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentId,
      newStatus,
    }: {
      apiClient: ZapEHRTelemedAPIClient;
    } & Omit<ChangeTelemedAppointmentStatusInput, 'secrets'>) => {
      return apiClient.changeTelemedAppointmentStatus({
        appointmentId,
        newStatus,
      });
    },
  });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditPatientInformationMutation = () => {
  const { fhirClient } = useApiClients();
  return useMutation({
    mutationFn: ({ patientData }: { patientData: Patient }) => {
      if (!fhirClient) {
        throw new Error('fhirClient not found');
      }
      return fhirClient.patchResource<Patient>({
        resourceType: 'Patient',
        resourceId: patientData.id ?? '',
        operations: [
          {
            op: 'replace',
            path: '/name',
            value: patientData.name,
          },
          {
            op: 'replace',
            path: '/birthDate',
            value: patientData.birthDate,
          },
        ],
      });
    },
    onError: (err) => {
      console.error('Error during editing patient information: ', err);
    },
  });
};
