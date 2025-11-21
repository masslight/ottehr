import { BundleEntry } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  Bundle,
  FhirResource,
  Organization,
  Patient,
  Questionnaire,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  getFirstName,
  getLastName,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  PromiseReturnType,
  RemoveCoverageZambdaInput,
  useSuccessQuery,
} from 'utils';
import ehrInsuranceUpdateFormJson from '../../../../config/oystehr/ehr-insurance-update-questionnaire.json';
import { OystehrTelemedAPIClient } from '../features/visits/shared/api/oystehrApi';
import { getPatientNameSearchParams } from '../helpers/patientSearch';
import { useApiClients } from './useAppClients';

export const useGetPatient = (
  id?: string
): {
  loading: boolean;
  otherPatientsWithSameName: boolean;
  setOtherPatientsWithSameName: (value: boolean) => void;
  patient?: Patient;
  setPatient: (patient: Patient) => void;
  relatedPerson?: RelatedPerson;
} => {
  const { oystehr } = useApiClients();
  const [loading, setLoading] = useState<boolean>(true);
  const [otherPatientsWithSameName, setOtherPatientsWithSameName] = useState<boolean>(false);
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
    queryFn: () =>
      oystehr && patientResource
        ? oystehr.fhir
            .search<FhirResource>({
              resourceType: 'Patient',
              params: getPatientNameSearchParams({
                firstLast: { first: getFirstName(patientResource), last: getLastName(patientResource) },
                narrowByRelatedPersonAndAppointment: false,
                maxResultOverride: 2,
              }),
            })
            .then((bundle) => bundle.unbundle())
        : null,
    gcTime: 10000,
    enabled: oystehr != null && patientResource != null,
  });

  useEffect(() => {
    async function getPatient(): Promise<void> {
      if (!oystehr) {
        throw new Error('oystehr is not defined');
      }

      setLoading(true);

      if (!patientResources || !otherPatientsWithSameNameResources) {
        return;
      }

      const patientTemp: Patient = patientResources.find((resource) => resource.resourceType === 'Patient') as Patient;
      const relatedPersonTemp: RelatedPerson = patientResources.find(
        (resource) => resource.resourceType === 'RelatedPerson'
      ) as RelatedPerson;

      if (otherPatientsWithSameNameResources.length > 1) {
        setOtherPatientsWithSameName(true);
      } else {
        setOtherPatientsWithSameName(false);
      }

      setPatient(patientTemp);
      setRelatedPerson(relatedPersonTemp);
      setLoading(false);
    }

    getPatient().catch((error) => console.log(error));
  }, [oystehr, patientResources, otherPatientsWithSameNameResources]);

  return {
    loading,
    otherPatientsWithSameName,
    setOtherPatientsWithSameName,
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
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetPatientCoverages = (
  {
    apiClient,
    patientId,
  }: {
    apiClient: OystehrTelemedAPIClient | null;
    patientId: string | null;
  },
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrTelemedAPIClient['getPatientCoverages']>>, Error> => {
  const queryResult = useQuery({
    queryKey: ['patient-coverages', { apiClient, patientId }],
    queryFn: () => {
      return apiClient!.getPatientCoverages({
        patientId: patientId!,
      });
    },
    enabled: apiClient != null && patientId != null,
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

export const useGetPatientDetailsUpdateForm = (
  onSuccess?: (data: Questionnaire | null) => void
): UseQueryResult<Questionnaire, Error> => {
  const { oystehr } = useApiClients();

  const questionnaire = Object.values(ehrInsuranceUpdateFormJson.fhirResources).find(
    (q) =>
      q.resource.resourceType === 'Questionnaire' &&
      q.resource.status === 'active' &&
      q.resource.url.includes('ehr-insurance-update-questionnaire')
  );

  const queryResult = useQuery({
    queryKey: ['patient-update-form'],

    queryFn: async () => {
      if (oystehr && questionnaire) {
        const searchResults = (
          await oystehr.fhir.search<Questionnaire>({
            resourceType: 'Questionnaire',
            params: [
              {
                name: 'url',
                value: questionnaire.resource.url,
              },
              {
                name: 'version',
                value: questionnaire.resource.version,
              },
            ],
          })
        ).unbundle();
        const form = searchResults[0];
        if (!form) {
          throw new Error('Form not found');
        }
        return form;
      } else {
        throw new Error('FHIR client not defined');
      }
    },

    enabled: Boolean(oystehr) && Boolean(questionnaire),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
