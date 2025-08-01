import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Patient } from 'fhir/r4b';
import { useSuccessQuery } from 'utils';
import {
  addOrReplaceOperation,
  ChangeTelemedAppointmentStatusInput,
  InitTelemedSessionRequestParams,
  SignAppointmentInput,
} from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { OystehrTelemedAPIClient, PromiseReturnType } from '../../data';
import { GetAppointmentsRequestParams } from '../../utils';

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
    }: {
      apiClient: OystehrTelemedAPIClient;
    } & Omit<SignAppointmentInput, 'secrets'>) => {
      return apiClient.signAppointment({
        appointmentId,
        timezone,
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
      fieldsToUpdate?: ('name' | 'birthDate' | 'gender' | 'address' | 'telecom')[];
    }) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }

      if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
        fieldsToUpdate = ['name', 'birthDate', 'address', 'telecom'];
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
