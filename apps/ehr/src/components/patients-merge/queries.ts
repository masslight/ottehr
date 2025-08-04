import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Patient } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useSuccessQuery } from 'utils';
import { useApiClients } from '../../hooks/useAppClients';

export const useGetPatientsForMerge = (
  {
    patientIds,
  }: {
    patientIds?: string[];
  },
  onSuccess?: (data: Patient[] | null) => void
): UseQueryResult<Patient[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['get-patients-for-merge', patientIds?.sort((a, b) => a.localeCompare(b))],

    queryFn: async (): Promise<Patient[]> => {
      if (oystehr && patientIds) {
        return (
          await oystehr.fhir.search<Patient>({
            resourceType: 'Patient',
            params: [{ name: '_id', value: patientIds.join(',') }],
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined or patientIds not provided');
    },

    enabled: Boolean(oystehr) && patientIds !== undefined,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetPatientForUpdate = (
  {
    patientId,
  }: {
    patientId?: string;
  },
  onSuccess?: (data: Patient[] | null) => void
): UseQueryResult<Patient[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['get-patient-for-update', patientId],

    queryFn: async (): Promise<Patient[]> => {
      if (oystehr && patientId) {
        return (
          await oystehr.fhir.search<Patient>({
            resourceType: 'Patient',
            params: [
              { name: '_id', value: patientId },
              {
                name: '_revinclude:iterate',
                value: 'QuestionnaireResponse:patient',
              },
              {
                name: '_revinclude:iterate',
                value: 'Task:requester',
              },
            ],
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined or patientId not provided');
    },

    enabled: Boolean(patientId) && Boolean(oystehr),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetPatientById = (): UseMutationResult<Patient[], Error, string> => {
  const { oystehr } = useApiClients();

  return useMutation({
    mutationFn: async (id: string): Promise<Patient[]> => {
      if (oystehr && id) {
        return (
          await oystehr.fhir.search<Patient>({
            resourceType: 'Patient',
            params: [{ name: '_id', value: id }],
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined or patient id not provided');
    },
    onError: () => {
      enqueueSnackbar('Patient not found. Please try again', { variant: 'error' });
    },
  });
};
