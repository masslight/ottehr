import { Bundle, FhirResource } from 'fhir/r4';
import { Patient } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useMutation, useQuery } from 'react-query';
import { useApiClients } from '../../hooks/useAppClients';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientsForMerge = (
  {
    patientIds,
  }: {
    patientIds?: string[];
  },
  onSuccess: (data: Bundle<FhirResource>[]) => void
) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['get-patients-for-merge', { patientIds }],
    async () => {
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
    {
      enabled: Boolean(oystehr) && patientIds !== undefined,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get patients for merge: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientForUpdate = (
  {
    patientId,
  }: {
    patientId?: string;
  },
  onSuccess: (data: Bundle<FhirResource>[]) => void
) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['get-patient-for-update', patientId],
    async () => {
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
    {
      enabled: Boolean(patientId) && Boolean(oystehr),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get patient for update: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientById = () => {
  const { oystehr } = useApiClients();

  return useMutation({
    mutationFn: async (id: string) => {
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
