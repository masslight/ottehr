import { Extension, InsurancePlan, Location, Organization } from 'fhir/r4b';
import { useMutation, useQuery } from 'react-query';
import { INSURANCE_PLAN_PAYER_META_TAG_CODE, INSURANCE_SETTINGS_MAP, isLocationVirtual } from 'utils';
import { FHIR_EXTENSION } from 'utils';
import { useApiClients } from '../../../hooks/useAppClients';
import { InsuranceData } from './EditInsurance';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useStatesQuery = () => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['state-locations', { oystehr }],
    async () => {
      const resources = await oystehr!.fhir.search<Location>({
        resourceType: 'Location',
        params: [
          {
            name: 'address-state:missing',
            value: 'false',
          },
        ],
      });

      return resources.unbundle().filter(isLocationVirtual);
    },
    {
      enabled: !!oystehr,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInsurancesQuery = (id?: string, enabled?: boolean) => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['insurances', { oystehr, id }],
    async () => {
      const searchParams = [];
      if (id) {
        searchParams.push({
          name: '_id',
          value: id,
        });
      }
      const resources = await oystehr!.fhir.search<InsurancePlan>({
        resourceType: 'InsurancePlan',
        params: searchParams,
      });

      return resources.unbundle();
    },
    {
      enabled: (enabled !== undefined ? enabled : true) && !!oystehr,
      cacheTime: 0,
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInsuranceMutation = (insurancePlan?: InsurancePlan) => {
  const { oystehr } = useApiClients();

  return useMutation(['insurances', { oystehr, id: insurancePlan?.id }], async (data: InsuranceData) => {
    const resourceExtensions = insurancePlan?.extension || [];
    const requirementSettingsExistingExtensions = resourceExtensions.find(
      (ext) => ext.url === FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url
    )?.extension;
    const requirementSettingsNewExtensions = requirementSettingsExistingExtensions || [];

    Object.keys(INSURANCE_SETTINGS_MAP).map((setting) => {
      const currentSettingExt: Extension = {
        url: setting,
        valueBoolean: data[setting as keyof typeof INSURANCE_SETTINGS_MAP],
      };

      const existingExtIndex = requirementSettingsNewExtensions.findIndex((ext) => ext.url === currentSettingExt.url);
      if (existingExtIndex >= 0) {
        requirementSettingsNewExtensions[existingExtIndex] = currentSettingExt;
      } else {
        requirementSettingsNewExtensions.push(currentSettingExt);
      }
    });

    const resource: InsurancePlan = {
      meta: {
        tag: [
          {
            code: INSURANCE_PLAN_PAYER_META_TAG_CODE,
          },
        ],
      },
      resourceType: 'InsurancePlan',
      status: data.status,
      name: data.displayName,
      ownedBy: { reference: `Organization/${data.payor?.id}` },
    };
    if (!requirementSettingsExistingExtensions) {
      resourceExtensions?.push({
        url: FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url,
        extension: requirementSettingsNewExtensions,
      });
    }
    resource.extension = resourceExtensions;

    if (!oystehr) throw new Error('Oystehr is not defined');
    let prom: Promise<InsurancePlan>;
    if (data.id) {
      resource.id = data.id;
      prom = oystehr.fhir.update<InsurancePlan>(resource);
    } else {
      prom = oystehr.fhir.create<InsurancePlan>(resource);
    }
    const response = await prom;
    return response;
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useInsuranceOrganizationsQuery = () => {
  const { oystehr } = useApiClients();

  return useQuery(
    ['insurance-organizations', { oystehr }],
    async () => {
      const resources = await oystehr!.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          {
            name: 'type',
            value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay',
          },
        ],
      });

      return resources.unbundle();
    },
    {
      enabled: !!oystehr,
    }
  );
};
