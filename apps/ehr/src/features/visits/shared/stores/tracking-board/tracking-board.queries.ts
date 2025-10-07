import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Patient } from 'fhir/r4b';
import { GetAppointmentsRequestParams } from 'src/features/visits/telemed/utils/appointments';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  addOrReplaceOperation,
  ChangeTelemedAppointmentStatusInput,
  InitTelemedSessionRequestParams,
  PromiseReturnType,
  SignAppointmentInput,
  useSuccessQuery,
} from 'utils';
import { OystehrTelemedAPIClient } from '../../api/oystehrApi';

export const useGetTelemedAppointments = (
  {
    apiClient,
    usStatesFilter,
    dateFilter,
    providersFilter,
    groupsFilter,
    patientFilter,
    statusesFilter,
    locationsIdsFilter,
    visitTypesFilter,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
  } & GetAppointmentsRequestParams,
  onSuccess: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getTelemedAppointments']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getTelemedAppointments']>>, Error> => {
  const queryResult = useQuery({
    queryKey: [
      'telemed-appointments',
      {
        usStatesFilter,
        providersFilter,
        groupsFilter,
        dateFilter,
        patientFilter,
        statusesFilter,
        locationsIdsFilter,
        visitTypesFilter,
      },
    ],

    queryFn: () => {
      if (apiClient) {
        return apiClient.getTelemedAppointments({
          usStatesFilter,
          providersFilter,
          groupsFilter,
          dateFilter,
          patientFilter,
          statusesFilter,
          locationsIdsFilter,
          visitTypesFilter,
        });
      }
      throw new Error('api client not defined');
    },

    enabled: Boolean(apiClient),
    refetchInterval: 10000,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useInitTelemedSessionMutation = (): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrTelemedAPIClient['initTelemedSession']>>,
  Error,
  {
    apiClient: OystehrTelemedAPIClient;
    appointmentId: string;
    userId: string;
  }
> =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentId,
      userId,
    }: {
      apiClient: OystehrTelemedAPIClient;
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
      apiClient: OystehrTelemedAPIClient;
    } & Omit<ChangeTelemedAppointmentStatusInput, 'secrets'>) => {
      return apiClient.changeTelemedAppointmentStatus({
        appointmentId,
        newStatus,
      });
    },
  });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSignAppointmentMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentId,
      timezone,
      supervisorApprovalEnabled,
    }: {
      apiClient: OystehrTelemedAPIClient;
    } & Omit<SignAppointmentInput, 'secrets'>) => {
      return apiClient.signAppointment({
        appointmentId,
        timezone,
        supervisorApprovalEnabled,
      });
    },
  });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditPatientInformationMutation = () => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationFn: ({
      originalPatientData,
      updatedPatientData,
      fieldsToUpdate,
    }: {
      originalPatientData: Patient;
      updatedPatientData: Patient;
      fieldsToUpdate?: ('name' | 'birthDate' | 'gender' | 'address' | 'telecom' | 'contact')[];
    }) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }

      if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
        fieldsToUpdate = ['name', 'birthDate', 'address', 'telecom', 'contact'];
      }
      const fieldsSet = [...new Set(fieldsToUpdate)];

      const patchOperations: Operation[] = fieldsSet.map((field) =>
        addOrReplaceOperation(originalPatientData[field], `/${field}`, updatedPatientData[field])
      );

      return oystehr.fhir.patch<Patient>({
        resourceType: 'Patient',
        id: updatedPatientData.id ?? '',
        operations: patchOperations,
      });
    },
    onError: (err) => {
      console.error('Error during editing patient information: ', err);
    },
  });
};
