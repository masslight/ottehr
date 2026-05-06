import { useMutation, UseMutationResult, useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { FhirResource, Patient, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { getFirstName, getLastName, PromiseReturnType, RemoveCoverageZambdaInput, useSuccessQuery } from 'utils';
import { OystehrTelemedAPIClient } from '../features/visits/shared/api/oystehrApi';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { useApiClients } from './useAppClients';

export const useGetPatient = (
  id?: string
): {
  loading: boolean;
  otherPatientsWithSameName: boolean;
  setOtherPatientsWithSameName: (value: boolean) => void;
  duplicatePatients: Patient[];
  patient?: Patient;
  setPatient: (patient: Patient) => void;
  relatedPerson?: RelatedPerson;
} => {
  const { oystehr } = useApiClients();
  const [loading, setLoading] = useState<boolean>(true);
  const [otherPatientsWithSameName, setOtherPatientsWithSameName] = useState<boolean>(false);
  const [duplicatePatients, setDuplicatePatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient>();
  const [relatedPerson, setRelatedPerson] = useState<RelatedPerson>();

  const { data: patientResources } = useQuery({
    queryKey: ['useGetPatientPatientResources', id],
    queryFn: () =>
      oystehr && id
        ? oystehr.fhir
            .search<FhirResource>({
              resourceType: 'Patient',
              params: [
                { name: '_id', value: id },
                {
                  name: '_revinclude:iterate',
                  value: 'RelatedPerson:patient',
                },
              ],
            })
            .then((bundle) => bundle.unbundle())
        : null,
    gcTime: 10000,
    enabled: oystehr != null && id != null,
  });

  const patientResource: Patient | undefined = patientResources?.find(
    (resource) => resource.resourceType === 'Patient'
  ) as Patient;

  const { data: otherPatientsWithSameNameResources } = useQuery({
    queryKey: ['otherPatientsWithSameNameResources', id],
    queryFn: () => {
      if (!oystehr || !patientResource) return null;
      const searchParams = getPatientNameSearchParams({
        firstLast: { first: getFirstName(patientResource), last: getLastName(patientResource) },
        narrowByRelatedPersonAndAppointment: false,
        maxResultOverride: 10,
      });
      if (patientResource.birthDate) {
        searchParams.push({ name: 'birthdate', value: patientResource.birthDate });
      }
      searchParams.push({ name: 'active', value: 'true' });
      return oystehr.fhir
        .search<FhirResource>({
          resourceType: 'Patient',
          params: searchParams,
        })
        .then((bundle) => bundle.unbundle());
    },
    gcTime: 10000,
    enabled: oystehr != null && patientResource != null,
  });

  useEffect(() => {
    async function getPatient(): Promise<void> {
      if (!oystehr) {
        throw new Error('oystehr is not defined');
      }

      if (!patientResources || !otherPatientsWithSameNameResources) {
        return;
      }

      setLoading(true);

      const patientTemp: Patient = patientResources.find((resource) => resource.resourceType === 'Patient') as Patient;
      const relatedPersonTemp: RelatedPerson = patientResources.find(
        (resource) => resource.resourceType === 'RelatedPerson'
      ) as RelatedPerson;

      const duplicates = (otherPatientsWithSameNameResources as Patient[]).filter(
        (r) => r.resourceType === 'Patient' && r.id !== id && r.active !== false
      );
      if (duplicates.length > 0) {
        setOtherPatientsWithSameName(true);
        setDuplicatePatients(duplicates);
      } else {
        setOtherPatientsWithSameName(false);
        setDuplicatePatients([]);
      }

      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
      setLoading(false);
    }

    getPatient().catch((error) => console.log(error));
  }, [id, oystehr, patientResources, otherPatientsWithSameNameResources]);

  return {
    loading,
    otherPatientsWithSameName,
    setOtherPatientsWithSameName,
    duplicatePatients,
    patient,
    relatedPerson,
    setPatient,
  };
};

export const useGetPatientAccount = (
  {
    apiClient,
    patientId,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    patientId: string | null;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientAccount']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientAccount']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['patient-account-get', { apiClient, patientId }],

    queryFn: () => {
      return apiClient!.getPatientAccount({
        patientId: patientId!,
      });
    },
    enabled: apiClient != null && patientId != null,
    refetchOnMount: false,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

type SafeQueryOptions<TData> = Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>;

export const useGetPatientCoverages = (
  {
    apiClient,
    patientId,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    patientId: string | null;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>> | null) => void,
  options?: SafeQueryOptions<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>>>
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['patient-coverages', { patientId }],
    queryFn: () => {
      return apiClient!.getPatientCoverages({
        patientId: patientId!,
      });
    },
    enabled: options?.enabled ?? (apiClient != null && patientId != null),
    refetchOnMount: false,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useRemovePatientCoverage = (): UseMutationResult<void, Error, RemoveCoverageZambdaInput> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationKey: ['remove-patient-coverage'],

    mutationFn: async (input: RemoveCoverageZambdaInput): Promise<void> => {
      try {
        if (!apiClient || !input) return;
        await apiClient.removePatientCoverage(input);
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
  });
};

export const useUpdatePatientAccount = (
  onSuccess?: () => void,
  successMessage: string = 'Patient information updated successfully'
): UseMutationResult<void, Error, QuestionnaireResponse> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationKey: ['update-patient-account'],

    mutationFn: async (questionnaireResponse: QuestionnaireResponse): Promise<void> => {
      try {
        if (!apiClient || !questionnaireResponse) return;
        await apiClient.updatePatientAccount({
          questionnaireResponse,
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    },

    onSuccess: () => {
      enqueueSnackbar(successMessage, {
        variant: 'success',
      });
      if (onSuccess) {
        onSuccess();
      }
    },

    onError: () => {
      enqueueSnackbar('Save operation failed. The server encountered an error while processing your request.', {
        variant: 'error',
      });
    },
  });
};
