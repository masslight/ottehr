import { InsurancePlan, Location, Organization } from 'fhir/r4';
import { useMutation, useQuery } from 'react-query';
import { PUBLIC_EXTENSION_BASE_URL } from 'ehr-utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { INSURANCE_SETTINGS_MAP, InsuranceData } from './EditInsurance';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useStatesQuery = () => {
  const { fhirClient } = useApiClients();

  return useQuery(
    ['state-locations', { fhirClient }],
    async () => {
      const resources = await fhirClient!.searchResources({
        resourceType: 'Location',
        searchParams: [
          {
            name: 'address-state:missing',
            value: 'false',
          },
          {
            name: 'name:contains',
            value: 'virtual',
          },
        ],
      });

      return (resources as Location[]).filter(
        (loca) =>
          loca.extension?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release')
            ?.valueCoding?.code === 'vi'
      );
    },
    {
      enabled: !!fhirClient,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInsurancesQuery = (id?: string, enabled?: boolean) => {
  const { fhirClient } = useApiClients();

  return useQuery(
    ['insurances', { fhirClient, id }],
    async () => {
      const searchParams = [];
      if (id) {
        searchParams.push({
          name: '_id',
          value: id,
        });
      }
      const resources = await fhirClient!.searchResources<InsurancePlan>({
        resourceType: 'InsurancePlan',
        searchParams: searchParams,
      });

      return resources as InsurancePlan[];
    },
    {
      enabled: (enabled !== undefined ? enabled : true) && !!fhirClient,
      cacheTime: 0,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInsuranceMutation = (id?: string) => {
  const { fhirClient } = useApiClients();

  return useMutation(['insurances', { fhirClient, id }], async (data: InsuranceData) => {
    const resource: InsurancePlan = {
      resourceType: 'InsurancePlan',
      status: data.status,
      name: data.displayName,
      ownedBy: { reference: `Organization/${data.payor?.id}` },
      extension: [
        {
          url: `${PUBLIC_EXTENSION_BASE_URL}/insurance-requirements`,
          extension: Object.keys(INSURANCE_SETTINGS_MAP).map((setting) => ({
            url: setting,
            valueBoolean: data[setting as keyof typeof INSURANCE_SETTINGS_MAP],
          })),
        },
      ],
    };
    if (!fhirClient) throw new Error('FhirClient is not defined');
    let method = fhirClient.createResource<InsurancePlan>;
    if (data.id) {
      resource.id = id;
      method = fhirClient.updateResource<InsurancePlan>;
    }
    const response = await method.bind(fhirClient)(resource);
    return response;
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInsuranceOrganizationsQuery = () => {
  const { fhirClient } = useApiClients();

  return useQuery(
    ['insurance-organizations', { fhirClient }],
    async () => {
      const resources = await fhirClient!.searchResources<Organization>({
        resourceType: 'Organization',
        searchParams: [
          {
            name: 'type',
            value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay',
          },
        ],
      });

      return resources;
    },
    {
      enabled: !!fhirClient,
    }
  );
};
