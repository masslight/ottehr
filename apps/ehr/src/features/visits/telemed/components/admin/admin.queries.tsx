import Oystehr from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Extension, Location, Organization } from 'fhir/r4b';
import {
  bulkUpdateInsuranceStatus,
  getImmunizationQuickPicks,
  getInHouseMedicationQuickPicks,
  getProcedureQuickPicks,
  getRadiologyQuickPicks,
  removeImmunizationQuickPick,
  removeInHouseMedicationQuickPick,
  removeProcedureQuickPick,
  removeRadiologyQuickPick,
  updateImmunizationQuickPick,
  updateInHouseMedicationQuickPick,
  updateProcedureQuickPick,
  updateRadiologyQuickPick,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  BulkUpdateInsuranceStatusInput,
  FHIR_EXTENSION,
  ImmunizationQuickPickData,
  InHouseMedicationQuickPickData,
  INSURANCE_SETTINGS_MAP,
  isLocationVirtual,
  ORG_TYPE_CODE_SYSTEM,
  ORG_TYPE_PAYER_CODE,
  ProcedureQuickPickData,
  RadiologyQuickPickData,
} from 'utils';
import { InsuranceData } from './EditInsurance';

export const useVirtualLocationsQuery = (): UseQueryResult<Location[], Error> => {
  const { oystehr } = useApiClients();

  return useQuery({
    queryKey: ['virtual-locations'],

    queryFn: async () => {
      const resources = await oystehr!.fhir.search<Location>({
        resourceType: 'Location',
        params: [
          {
            name: 'address-state:missing',
            value: 'false',
          },
        ],
      });

      return resources
        .unbundle()
        .filter(isLocationVirtual)
        .sort((a, b) => {
          const stateA = a.address?.state || '';
          const stateB = b.address?.state || '';
          return stateA.localeCompare(stateB);
        });
    },

    enabled: !!oystehr,
  });
};

export const useInsurancesQuery = (id?: string, enabled?: boolean): UseQueryResult<Organization[], Error> => {
  const { oystehr } = useApiClients();

  return useQuery({
    queryKey: ['insurances', id],

    queryFn: async () => {
      const searchParams = [];
      let offset = 0;
      if (id) {
        searchParams.push({
          name: '_id',
          value: id,
        });
      }
      searchParams.push(
        {
          name: '_count',
          value: '1000',
        },
        {
          name: 'type',
          value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
        },
        {
          name: '_offset',
          value: offset,
        }
      );
      let plans: Organization[] = [];
      let resources = await oystehr!.fhir.search<Organization>({
        resourceType: 'Organization',
        params: searchParams,
      });
      plans = plans.concat(resources.unbundle());
      while (resources.link?.find((link) => link.relation === 'next')) {
        resources = await oystehr!.fhir.search<Organization>({
          resourceType: 'Organization',
          params: searchParams.map((param) => {
            if (param.name === '_offset') {
              return {
                ...param,
                value: (offset += 1000),
              };
            }
            return param;
          }),
        });
        plans = plans.concat(resources.unbundle());
      }

      return plans;
    },
    enabled: enabled && !!oystehr,
    gcTime: 0,
  });
};

export const useInsuranceMutation = (
  insurancePlan?: Organization
): UseMutationResult<Organization, Error, InsuranceData> => {
  const { oystehr } = useApiClients();

  return useMutation({
    mutationKey: ['insurances', insurancePlan?.id],

    mutationFn: async (data: InsuranceData) => {
      const resourceExtensions = insurancePlan?.extension || [];
      const requirementSettingsExistingExtensions = resourceExtensions.find(
        (ext) => ext.url === FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url
      )?.extension;
      const requirementSettingsNewExtensions = requirementSettingsExistingExtensions || [];

      Object.keys(INSURANCE_SETTINGS_MAP).map((setting) => {
        if (data[setting as keyof typeof INSURANCE_SETTINGS_MAP] === undefined) {
          return;
        }
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

      const resource: Organization = {
        resourceType: 'Organization',
        active: data.active ?? true,
        name: insurancePlan?.name || data.payor?.name,
        alias: data.displayName ? [data.displayName] : undefined,
        type: [
          {
            coding: [
              {
                system: ORG_TYPE_CODE_SYSTEM,
                code: ORG_TYPE_PAYER_CODE,
              },
            ],
          },
        ],
        identifier: insurancePlan?.identifier || data?.identifier,
        address: insurancePlan?.address || data?.address,
      };

      if (data.notes) {
        const noteExt = {
          url: FHIR_EXTENSION.InsurancePlan.notes.url,
          valueString: data.notes,
        };

        const existingExtIndex = resourceExtensions.findIndex(
          (ext) => ext.url === FHIR_EXTENSION.InsurancePlan.notes.url
        );
        if (existingExtIndex >= 0) {
          resourceExtensions[existingExtIndex] = noteExt;
        } else {
          resourceExtensions.push(noteExt);
        }
      }
      if (data.notes && data.notes === '') {
        const existingExtIndex = resourceExtensions.findIndex(
          (ext) => ext.url === FHIR_EXTENSION.InsurancePlan.notes.url
        );
        if (existingExtIndex >= 0) {
          resourceExtensions.splice(existingExtIndex, 1);
        }
      }

      // TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
      // if (!requirementSettingsExistingExtensions) {
      //   resourceExtensions?.push({
      //     url: FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url,
      //     extension: requirementSettingsNewExtensions,
      //   });
      // }
      resource.extension = resourceExtensions;

      if (!oystehr) throw new Error('Oystehr is not defined');
      let prom: Promise<Organization>;
      if (data.id) {
        resource.id = data.id;
        prom = oystehr.fhir.update<Organization>(resource);
      } else {
        prom = oystehr.fhir.create<Organization>(resource);
      }
      const response = await prom;
      return response;
    },
  });
};

export const useInsuranceOrganizationsQuery = (): UseQueryResult<Organization[], Error> => {
  const { oystehr } = useApiClients();

  return useQuery({
    queryKey: ['insurance-organizations'],

    queryFn: async () => {
      const resources = await oystehr!.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          {
            name: 'type',
            value: `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_PAYER_CODE}`,
          },
        ],
      });

      return resources.unbundle();
    },

    enabled: !!oystehr,
  });
};

export const useBulkInsuranceStatusMutation = (): UseMutationResult<void, Error, BulkUpdateInsuranceStatusInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['bulk-insurance-status'],

    mutationFn: async (data: BulkUpdateInsuranceStatusInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      await bulkUpdateInsuranceStatus(oystehrZambda, data);
    },
  });
};

// ── Generic Quick Pick hook factories ──

function makeQuickPicksQuery<T extends { id?: string; name: string }>(
  queryKey: string,
  fetchFn: (oystehrZambda: Oystehr) => Promise<{ quickPicks: T[] }>
): () => UseQueryResult<T[], Error> {
  return () => {
    const { oystehrZambda } = useApiClients();
    return useQuery({
      queryKey: [queryKey],
      queryFn: async () => {
        const response = await fetchFn(oystehrZambda!);
        return [...response.quickPicks].sort((a, b) => a.name.localeCompare(b.name));
      },
      enabled: !!oystehrZambda,
    });
  };
}

function makeRenameQuickPickMutation<T extends { id?: string; name: string }>(
  queryKey: string,
  updateFn: (oystehrZambda: Oystehr, id: string, data: Omit<T, 'id'>) => Promise<unknown>
): () => UseMutationResult<void, Error, { quickPick: T; newName: string }> {
  return () => {
    const { oystehrZambda } = useApiClients();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ quickPick, newName }) => {
        if (!oystehrZambda) throw new Error('oystehrZambda is not defined');
        if (!quickPick.id) throw new Error('quick pick id is undefined');
        const { id, name: _name, ...rest } = quickPick;
        await updateFn(oystehrZambda, id, { ...rest, name: newName } as Omit<T, 'id'>);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  };
}

function makeRemoveQuickPickMutation(
  queryKey: string,
  removeFn: (oystehrZambda: Oystehr, id: string) => Promise<unknown>
): () => UseMutationResult<void, Error, string> {
  return () => {
    const { oystehrZambda } = useApiClients();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        if (!oystehrZambda) throw new Error('oystehrZambda is not defined');
        await removeFn(oystehrZambda, id);
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  };
}

// ── Quick Pick hooks ──

export const useImmunizationQuickPicksQuery = makeQuickPicksQuery(
  'immunization-quick-picks',
  getImmunizationQuickPicks
);
export const useRenameImmunizationQuickPickMutation = makeRenameQuickPickMutation<ImmunizationQuickPickData>(
  'immunization-quick-picks',
  updateImmunizationQuickPick
);
export const useRemoveImmunizationQuickPickMutation = makeRemoveQuickPickMutation(
  'immunization-quick-picks',
  removeImmunizationQuickPick
);

export const useInHouseMedicationQuickPicksQuery = makeQuickPicksQuery(
  'in-house-medication-quick-picks',
  getInHouseMedicationQuickPicks
);
export const useRenameInHouseMedicationQuickPickMutation = makeRenameQuickPickMutation<InHouseMedicationQuickPickData>(
  'in-house-medication-quick-picks',
  updateInHouseMedicationQuickPick
);
export const useRemoveInHouseMedicationQuickPickMutation = makeRemoveQuickPickMutation(
  'in-house-medication-quick-picks',
  removeInHouseMedicationQuickPick
);

export const useProcedureQuickPicksQuery = makeQuickPicksQuery('procedure-quick-picks', getProcedureQuickPicks);
export const useRenameProcedureQuickPickMutation = makeRenameQuickPickMutation<ProcedureQuickPickData>(
  'procedure-quick-picks',
  updateProcedureQuickPick
);
export const useRemoveProcedureQuickPickMutation = makeRemoveQuickPickMutation(
  'procedure-quick-picks',
  removeProcedureQuickPick
);

export const useRadiologyQuickPicksQuery = makeQuickPicksQuery('radiology-quick-picks', getRadiologyQuickPicks);
export const useRenameRadiologyQuickPickMutation = makeRenameQuickPickMutation<RadiologyQuickPickData>(
  'radiology-quick-picks',
  updateRadiologyQuickPick
);
export const useRemoveRadiologyQuickPickMutation = makeRemoveQuickPickMutation(
  'radiology-quick-picks',
  removeRadiologyQuickPick
);
