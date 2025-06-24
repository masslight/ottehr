import {
  Appointment,
  Bundle,
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
import { useMutation, useQuery } from 'react-query';
import { INSURANCE_PLAN_PAYER_META_TAG_CODE } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { findResourceByType, generateOpByResourceData, getCoverageRelatedResources } from '../../utils';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetClaim = (
  {
    claimId,
  }: {
    claimId: string | undefined;
  },
  onSuccess: (data: Bundle<FhirResource>[]) => void
) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['rcm-claim', claimId],
    async () => {
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
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get claim: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetInsurancePlans = (onSuccess: (data: InsurancePlan[]) => void) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['rcm-insurance-plans'],
    async () => {
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
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get insurance plans: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetOrganizations = (onSuccess: (data: Organization[]) => void) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['rcm-organizations'],
    async () => {
      if (oystehr) {
        return (
          await oystehr.fhir.search<Organization>({
            resourceType: 'Organization',
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get organizations: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetFacilities = (onSuccess: (data: Location[]) => void) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['rcm-facilities'],
    async () => {
      if (oystehr) {
        return (
          await oystehr.fhir.search<Location>({
            resourceType: 'Location',
          })
        ).unbundle();
      }
      throw new Error('fhir client not defined');
    },
    {
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get facilities: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditCoverageInformationMutation = () => {
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditRelatedPersonInformationMutation = () => {
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useEditClaimInformationMutation = () => {
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
