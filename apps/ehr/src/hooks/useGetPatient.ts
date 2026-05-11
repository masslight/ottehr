import { BundleEntry } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { Bundle, FhirResource, Organization, Patient, Person, QuestionnaireResponse, RelatedPerson } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  getFirstName,
  getLastName,
  isValidUUID,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  PromiseReturnType,
  RemoveCoverageZambdaInput,
  useSuccessQuery,
} from 'utils';
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
  person?: Person;
} => {
  const { oystehr } = useApiClients();
  const [loading, setLoading] = useState<boolean>(true);
  const [otherPatientsWithSameName, setOtherPatientsWithSameName] = useState<boolean>(false);
  const [duplicatePatients, setDuplicatePatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient>();
  const [relatedPerson, setRelatedPerson] = useState<RelatedPerson>();
  const [person, setPerson] = useState<Person>();

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
                {
                  name: '_revinclude:iterate',
                  value: 'Person:link',
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
      const personTemp: Person = patientResources.find((resource) => resource.resourceType === 'Person') as Person;

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
      setPerson(personTemp);
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
    person,
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

/**
 * Polls the merge-patients zambda for the active merge Task targeting the given
 * patient. Returns `null` if no active merge is in progress.
 */
export const useGetActiveMergeTask = (
  patientId: string | undefined,
  options?: { enabled?: boolean; refetchIntervalMs?: number }
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getMergePatientsTask']>>, Error> => {
  const apiClient = useOystehrAPIClient();
  const refetchIntervalMs = options?.refetchIntervalMs ?? 3000;

  // Guard against bogus route params like the literal string "undefined".
  // Without this, broken `/patient/${someUndefined}/info` URLs send
  // {"patientId":"undefined","mode":"status"} to the merge-patients zambda and
  // produce noisy 400s.
  const validPatientId = patientId && isValidUUID(patientId) ? patientId : undefined;

  return useQuery({
    queryKey: ['active-merge-task', { patientId: validPatientId }],
    queryFn: () => apiClient!.getMergePatientsTask({ patientId: validPatientId! }),
    enabled: (options?.enabled ?? true) && apiClient != null && !!validPatientId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.task) return false;
      // Stop polling on terminal states — user must dismiss/retry.
      if (data.task.status === 'failed') return false;
      return refetchIntervalMs;
    },
    refetchOnWindowFocus: true,
  });
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

export const useGetInsurancePlans = (
  onSuccess: (data: Bundle<Organization> | null) => void
): UseQueryResult<Bundle<Organization>, Error> => {
  const { oystehr } = useApiClients();

  const fetchAllInsurancePlans = async (): Promise<Bundle<Organization>> => {
    if (!oystehr) {
      throw new Error('FHIR client not defined');
    }

    const searchParams = [
      { name: 'type', value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}` },
      { name: '_count', value: '1000' },
    ];

    let offset = 0;
    let allEntries: BundleEntry<Organization>[] = [];

    let bundle = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [...searchParams, { name: '_offset', value: offset }],
    });

    allEntries = allEntries.concat(bundle.entry || []);
    const serverTotal = bundle.total;

    while (bundle.link?.find((link) => link.relation === 'next')) {
      offset += 1000;

      bundle = await oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [...searchParams.filter((param) => param.name !== '_offset'), { name: '_offset', value: offset }],
      });

      allEntries = allEntries.concat(bundle.entry || []);
    }

    return {
      ...bundle,
      entry: allEntries,
      total: serverTotal !== undefined ? serverTotal : allEntries.length,
    };
  };

  const queryResult = useQuery({
    queryKey: ['insurance-plans'],
    queryFn: fetchAllInsurancePlans,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
