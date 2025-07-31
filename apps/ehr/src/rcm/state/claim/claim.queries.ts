import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  Appointment,
  Claim,
  Coverage,
  DocumentReference,
  Encounter,
  FhirResource,
  InsurancePlan,
  Location,
  Organization,
  Patient,
  RelatedPerson,
} from 'fhir/r4b';
import { useSuccessQuery } from 'utils';
import { INSURANCE_PLAN_PAYER_META_TAG_CODE } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { findResourceByType, generateOpByResourceData, getCoverageRelatedResources } from '../../utils';

export const useGetClaim = (
  {
    claimId,
  }: {
    claimId: string | undefined;
  },
  onSuccess: (data: FhirResource[] | null) => void
): UseQueryResult<FhirResource[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['rcm-claim', claimId],

    queryFn: async () => {
      if (oystehr && claimId) {
        const resources = (
          await oystehr.fhir.search<
            Appointment | Claim | Coverage | DocumentReference | Encounter | Patient | RelatedPerson
          >({
            resourceType: 'Claim',
            params: [
              { name: '_id', value: claimId },
              {
                name: '_include',
                value: 'Claim:patient',
              },
              {
                name: '_include',
                value: 'Claim:encounter',
              },
              {
                name: '_include:iterate',
                value: 'Encounter:appointment',
              },
              {
                name: '_revinclude:iterate',
                value: 'DocumentReference:encounter',
              },
            ],
          })
        ).unbundle();

        const claim = findResourceByType<Claim>(resources, 'Claim');

        const coverageReference = claim?.insurance?.[0]?.coverage?.reference;
        const coverageResourcesPromise = getCoverageRelatedResources(oystehr, coverageReference);

        const additionalCoverageReference = claim?.insurance?.[1]?.coverage?.reference;
        const additionalCoverageResourcesPromise = getCoverageRelatedResources(oystehr, additionalCoverageReference);

        resources.push(...(await coverageResourcesPromise));
        resources.push(...(await additionalCoverageResourcesPromise));

        return resources;
      }
      throw new Error('fhir client not defined or claimId not provided');
    },
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetInsurancePlans = (
  onSuccess: (data: InsurancePlan[] | null) => void
): UseQueryResult<InsurancePlan[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['rcm-insurance-plans'],

    queryFn: async () => {
      if (oystehr) {
        return (
          await oystehr.fhir.search<InsurancePlan>({
            resourceType: 'InsurancePlan',
            params: [
              {
                name: '_tag',
                value: INSURANCE_PLAN_PAYER_META_TAG_CODE,
              },
              {
                name: 'status',
                value: 'active',
              },
            ],
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined');
    },
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetOrganizations = (
  onSuccess: (data: Organization[] | null) => void
): UseQueryResult<Organization[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['rcm-organizations'],

    queryFn: async () => {
      if (oystehr) {
        return (
          await oystehr.fhir.search<Organization>({
            resourceType: 'Organization',
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined');
    },
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useGetFacilities = (onSuccess: (data: Location[] | null) => void): UseQueryResult<Location[], Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['rcm-facilities'],

    queryFn: async () => {
      if (oystehr) {
        return (
          await oystehr.fhir.search<Location>({
            resourceType: 'Location',
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined');
    },
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useEditCoverageInformationMutation = (): UseMutationResult<
  Coverage,
  Error,
  {
    coverageData: Coverage;
    previousCoverageData: Coverage;
    fieldsToUpdate?: ('relationship' | 'class' | 'payor' | 'subscriberId')[];
  }
> => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationFn: ({
      coverageData,
      previousCoverageData,
      fieldsToUpdate,
    }: {
      coverageData: Coverage;
      previousCoverageData: Coverage;
      fieldsToUpdate?: ('relationship' | 'class' | 'payor' | 'subscriberId')[];
    }) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }

      if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
        fieldsToUpdate = ['relationship'];
      }
      const fieldsSet = [...new Set(fieldsToUpdate)];

      const operations = fieldsSet
        .filter((field) => coverageData[field] !== undefined || previousCoverageData[field] !== undefined)
        .map((field) => ({
          op: generateOpByResourceData(coverageData, previousCoverageData, field),
          path: `/${field}`,
          value: coverageData[field],
        }));

      if (operations.length === 0) {
        return Promise.resolve(coverageData);
      }

      return oystehr.fhir.patch<Coverage>({
        resourceType: 'Coverage',
        id: coverageData.id ?? '',
        operations: operations,
      });
    },
    onError: (err) => {
      console.error('Error during editing coverage information: ', err);
    },
  });
};

export const useEditRelatedPersonInformationMutation = (): UseMutationResult<
  RelatedPerson,
  Error,
  {
    relatedPersonData: RelatedPerson;
    previousRelatedPersonData: RelatedPerson;
    fieldsToUpdate?: ('address' | 'birthDate' | 'gender' | 'name')[];
  }
> => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationFn: ({
      relatedPersonData,
      previousRelatedPersonData,
      fieldsToUpdate,
    }: {
      relatedPersonData: RelatedPerson;
      previousRelatedPersonData: RelatedPerson;
      fieldsToUpdate?: ('address' | 'birthDate' | 'gender' | 'name')[];
    }) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }

      if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
        fieldsToUpdate = ['address', 'birthDate', 'gender', 'name'];
      }
      const fieldsSet = [...new Set(fieldsToUpdate)];

      return oystehr.fhir.patch<RelatedPerson>({
        resourceType: 'RelatedPerson',
        id: relatedPersonData.id ?? '',
        operations: fieldsSet
          .filter((field) => relatedPersonData[field] !== undefined || previousRelatedPersonData[field] !== undefined)
          .map((field) => ({
            op: generateOpByResourceData(relatedPersonData, previousRelatedPersonData, field),
            path: `/${field}`,
            value: relatedPersonData[field],
          })),
      });
    },
    onError: (err) => {
      console.error('Error during editing related person information: ', err);
    },
  });
};

export const useEditClaimInformationMutation = (): UseMutationResult<
  Claim,
  Error,
  {
    claimData: Claim;
    previousClaimData: Claim;
    fieldsToUpdate?: (
      | 'accident'
      | 'extension'
      | 'supportingInfo'
      | 'related'
      | 'insurance'
      | 'diagnosis'
      | 'item'
      | 'total'
      | 'facility'
      | 'provider'
      | 'enterer'
    )[];
  }
> => {
  const { oystehr } = useApiClients();
  return useMutation({
    mutationFn: ({
      claimData,
      previousClaimData,
      fieldsToUpdate,
    }: {
      claimData: Claim;
      previousClaimData: Claim;
      fieldsToUpdate?: (
        | 'accident'
        | 'extension'
        | 'supportingInfo'
        | 'related'
        | 'insurance'
        | 'diagnosis'
        | 'item'
        | 'total'
        | 'facility'
        | 'provider'
        | 'enterer'
      )[];
    }) => {
      if (!oystehr) {
        throw new Error('Oystehr not found');
      }

      if (!fieldsToUpdate || fieldsToUpdate.length === 0) {
        fieldsToUpdate = ['accident', 'extension', 'supportingInfo', 'related', 'insurance'];
      }
      const fieldsSet = [...new Set(fieldsToUpdate)];

      return oystehr.fhir.patch<Claim>({
        resourceType: 'Claim',
        id: claimData.id ?? '',
        operations: fieldsSet
          .filter((field) => claimData[field] !== undefined || previousClaimData[field] !== undefined)
          .map((field) => ({
            op: generateOpByResourceData(claimData, previousClaimData, field),
            path: `/${field}`,
            value: claimData[field],
          })),
      });
    },
    onError: (err) => {
      console.error('Error during editing claim information: ', err);
    },
  });
};
