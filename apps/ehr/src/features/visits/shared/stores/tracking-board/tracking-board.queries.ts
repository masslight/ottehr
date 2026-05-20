import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { Operation } from 'fast-json-patch';
import { Patient } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import { addOrReplaceOperation, InitTelemedSessionRequestParams, PromiseReturnType, SignAppointmentInput } from 'utils';
import { OystehrTelemedAPIClient } from '../../api/oystehrApi';

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
export const useSignAppointmentMutation = () =>
  useMutation({
    mutationFn: ({
      apiClient,
      appointmentId,
      encounterId,
      timezone,
      supervisorApprovalEnabled,
    }: {
      apiClient: OystehrTelemedAPIClient;
    } & Omit<SignAppointmentInput, 'secrets'>) => {
      return apiClient.signAppointment({
        appointmentId,
        encounterId,
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
