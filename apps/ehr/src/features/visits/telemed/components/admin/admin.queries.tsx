import Oystehr, { RcmListPayersResponse } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Location, Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import {
  adminAddInHouseLab,
  adminAddLabSet,
  adminGetInHouseLabConfig,
  adminGetLabSets,
  adminListInHouseLabs,
  adminUpdateInHouseLab,
  adminUpdateLabelPrintingConfig,
  adminUpdateLabSet,
  adminUpdateLocationSupportPhones,
  adminUpdateSupportDialog,
  bulkUpdateInsuranceStatus,
  createEmCode,
  deleteEmCode,
  getImmunizationQuickPicks,
  getInHouseMedicationQuickPicks,
  getLabelPrintingConfig,
  getProcedureQuickPicks,
  getRadiologyQuickPicks,
  getSupportDialog,
  practiceManagedQuestionnaireCreate,
  practiceManagedQuestionnaireList,
  practiceManagedQuestionnaireUpdate,
  removeQuickPick,
  updateEmCode,
  updateImmunizationQuickPick,
  updateInHouseMedicationQuickPick,
  updateProcedureQuickPick,
  updateRadiologyQuickPick,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AdminAddInHouseLabInput,
  AdminAddInHouseLabOutput,
  AdminAddLabSetInput,
  AdminAddLabSetOutput,
  AdminGetInHouseLabConfigInput,
  AdminGetLabSetDetailInput,
  AdminGetLabSetDetailOutput,
  AdminGetLabSetListOutput,
  AdminInHouseLabConfigOutput,
  AdminListInHouseLabsOutput,
  AdminUpdateInHouseLabInput,
  AdminUpdateLabSetInput,
  AdminUpdateLocationSupportPhonesInput,
  AdminUpdatePrintingConfigInput,
  AdminUpdateSupportDialogInput,
  APIError,
  BulkUpdateInsuranceStatusInput,
  CreateEmCodeInput,
  DeleteEmCodeInput,
  EmCodeOption,
  getApiError,
  GetLabelPrintingConfigInput,
  GetLabelPrintingConfigOutput,
  GetSupportDialogOutput,
  ImmunizationQuickPickData,
  InHouseMedicationQuickPickData,
  isApiError,
  isLocationVirtual,
  PracticeManagedQuestionnaireCreateInput,
  PracticeManagedQuestionnaireCreateOutput,
  PracticeManagedQuestionnaireDetailInput,
  PracticeManagedQuestionnaireDetailOutput,
  PracticeManagedQuestionnaireListOutput,
  PracticeManagedQuestionnaireUpdateInput,
  PracticeManagedQuestionnaireUpdateOutput,
  ProcedureQuickPickData,
  RadiologyQuickPickData,
  UpdateEmCodeInput,
} from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';

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

export const useInsurancesQuery = (ids?: string[], enabled?: boolean): UseQueryResult<Organization[], Error> => {
  const { oystehr } = useApiClients();

  return useQuery({
    queryKey: ['insurances', ids],

    queryFn: async () => {
      if (!oystehr) {
        throw new Error('Oystehr client is not defined');
      }
      if (ids) {
        if (!ids.length) {
          return [];
        }
        const payers = await Promise.all(ids.map((id) => oystehr.rcm.getPayer({ id })));
        return payers;
      }
      const payers = [];
      let hasMore = true;
      let nextCursor: string | null = null;
      while (hasMore) {
        const result: RcmListPayersResponse = await oystehr.rcm.listPayers({
          limit: 200,
          cursor: nextCursor ?? undefined,
        });
        payers.push(...result.data);
        nextCursor = result.metadata.nextCursor;
        hasMore = !!nextCursor;
      }
      return payers;
    },
    enabled: enabled && !!oystehr,
    gcTime: 0,
  });
};

export const useInsuranceMutation = (
  payerId: string
): UseMutationResult<
  void,
  Error,
  {
    existingName?: string;
    name?: string;
    existingNote?: string;
    note?: string;
    showInPaperwork?: boolean;
  }
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['insurances', payerId],

    mutationFn: async (data: {
      existingName?: string;
      name?: string;
      existingNote?: string;
      note?: string;
      showInPaperwork?: boolean;
    }) => {
      if (data.showInPaperwork) {
        if (!data.existingName && data.name) {
          await oystehrZambda?.zambda.execute({
            id: 'add-payer-to-insurance-override-list',
            listName: 'patient',
            payerId,
            payerNameOverride: data.name,
          });
        }
        if (data.existingName && data.existingName !== data.name) {
          await oystehrZambda?.zambda.execute({
            id: 'edit-payer-in-insurance-override-list',
            listName: 'patient',
            payerId,
            payerNameOverride: data.name,
          });
        }
      }
      if (!data.showInPaperwork) {
        await oystehrZambda?.zambda.execute({
          id: 'remove-payer-from-insurance-override-list',
          listName: 'patient',
          payerId,
        });
      }
      if (!data.existingNote && data.note) {
        await oystehrZambda?.zambda.execute({
          id: 'add-payer-to-insurance-override-list',
          listName: 'ehr',
          payerId,
          payerNote: data.note,
        });
      }
      if (data.existingNote && data.note && data.existingNote !== data.note) {
        await oystehrZambda?.zambda.execute({
          id: 'edit-payer-in-insurance-override-list',
          listName: 'ehr',
          payerId,
          payerNote: data.note,
        });
      }
      if (data.existingNote && !data.note) {
        await oystehrZambda?.zambda.execute({
          id: 'remove-payer-from-insurance-override-list',
          listName: 'ehr',
          payerId,
        });
      }
    },
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

function makeRemoveQuickPickMutation(queryKey: string): () => UseMutationResult<void, Error, string> {
  return () => {
    const { oystehrZambda } = useApiClients();
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        if (!oystehrZambda) throw new Error('oystehrZambda is not defined');
        await removeQuickPick(oystehrZambda, id);
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
export const useRemoveImmunizationQuickPickMutation = makeRemoveQuickPickMutation('immunization-quick-picks');

export const useInHouseMedicationQuickPicksQuery = makeQuickPicksQuery(
  'in-house-medication-quick-picks',
  getInHouseMedicationQuickPicks
);
export const useRenameInHouseMedicationQuickPickMutation = makeRenameQuickPickMutation<InHouseMedicationQuickPickData>(
  'in-house-medication-quick-picks',
  updateInHouseMedicationQuickPick
);
export const useRemoveInHouseMedicationQuickPickMutation = makeRemoveQuickPickMutation(
  'in-house-medication-quick-picks'
);

export const useProcedureQuickPicksQuery = makeQuickPicksQuery('procedure-quick-picks', getProcedureQuickPicks);
export const useRenameProcedureQuickPickMutation = makeRenameQuickPickMutation<ProcedureQuickPickData>(
  'procedure-quick-picks',
  updateProcedureQuickPick
);
export const useRemoveProcedureQuickPickMutation = makeRemoveQuickPickMutation('procedure-quick-picks');

export const useRadiologyQuickPicksQuery = makeQuickPicksQuery('radiology-quick-picks', getRadiologyQuickPicks);
export const useRenameRadiologyQuickPickMutation = makeRenameQuickPickMutation<RadiologyQuickPickData>(
  'radiology-quick-picks',
  updateRadiologyQuickPick
);
export const useRemoveRadiologyQuickPickMutation = makeRemoveQuickPickMutation('radiology-quick-picks');

export const useAdminListInHouseLabs = (): UseQueryResult<AdminListInHouseLabsOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['admin-in-house-labs-list'],
    queryFn: async () => {
      return adminListInHouseLabs(oystehrZambda!);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec staletime
  });
};

export const useAdminAddInHouseLab = (): UseMutationResult<
  AdminAddInHouseLabOutput,
  Error,
  AdminAddInHouseLabInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-add-in-house-lab'],
    mutationFn: async (input: AdminAddInHouseLabInput) => {
      console.log('mutation for add in house lab called');
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      return adminAddInHouseLab(oystehrZambda!, input);
    },
    onSuccess: async (_data, _variables) => {
      // invalidate so the list page re-loads correctly
      await queryClient.invalidateQueries({
        queryKey: ['admin-in-house-labs-list'],
      });
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      let message = 'Something went wrong! In-house lab could not be created.';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminGetInHouseLabConfig = (
  input: AdminGetInHouseLabConfigInput
): UseQueryResult<AdminInHouseLabConfigOutput, Error> => {
  const { oystehrZambda } = useApiClients();
  const { activityDefinitionId } = input;

  return useQuery({
    queryKey: ['admin-get-in-house-lab-config', activityDefinitionId],
    queryFn: async () => {
      return adminGetInHouseLabConfig(oystehrZambda!, input);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec staletime
    refetchOnMount: 'always', // refetch every mount
    refetchOnWindowFocus: true, // refetch when you tab back
  });
};

// on mutate for update, need to invalidate the list endpoint and the get config endpoint
export const useAdminUpdateInHouseLab = (
  mutatingActivityDefinitionId: string
): UseMutationResult<AdminInHouseLabConfigOutput, Error, AdminUpdateInHouseLabInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-update-in-house-lab', mutatingActivityDefinitionId],
    mutationFn: async (input: AdminUpdateInHouseLabInput) => {
      console.log('mutation for update in house lab called');
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      return adminUpdateInHouseLab(oystehrZambda!, input);
    },
    onSuccess: async (data, _variables) => {
      // invalidate so the list page and get-page re-loads correctly
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin-in-house-labs-list'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['admin-get-in-house-lab-config', data.activityDefinitionId],
        }),
      ]);
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      let message = 'Something went wrong! In-house lab update could not be made.';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminCreateEmCodeMutation = (): UseMutationResult<EmCodeOption[], Error, CreateEmCodeInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['em-codes', 'create'],
    mutationFn: async (data: CreateEmCodeInput) => {
      if (!oystehrZambda) throw new Error('Oystehr client is not defined');
      const result = await createEmCode(oystehrZambda, data);
      return result.codes;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['em-codes'] });
    },
    onError: (error: any) => {
      safelyCaptureException(error);
      let message = 'Failed to create E&M code';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminUpdateEmCodeMutation = (): UseMutationResult<EmCodeOption[], Error, UpdateEmCodeInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['em-codes', 'update'],
    mutationFn: async (data: UpdateEmCodeInput) => {
      if (!oystehrZambda) throw new Error('Oystehr client is not defined');
      const result = await updateEmCode(oystehrZambda, data);
      return result.codes;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['em-codes'] });
    },
    onError: (error: any) => {
      safelyCaptureException(error);
      let message = 'Failed to update E&M code';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminDeleteEmCodeMutation = (): UseMutationResult<EmCodeOption[], Error, DeleteEmCodeInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['em-codes', 'delete'],
    mutationFn: async (data: DeleteEmCodeInput) => {
      if (!oystehrZambda) throw new Error('Oystehr client is not defined');
      const result = await deleteEmCode(oystehrZambda, data);
      return result.codes;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['em-codes'] });
    },
    onError: (error: any) => {
      safelyCaptureException(error);
      let message = 'Failed to delete E&M code';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminGetLabSetsList = (): UseQueryResult<AdminGetLabSetListOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['admin-get-lab-sets'],
    queryFn: async () => {
      return adminGetLabSets(oystehrZambda!);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec staletime
  });
};

export const useAdminGetLabSetDetail = (
  input: AdminGetLabSetDetailInput
): UseQueryResult<AdminGetLabSetDetailOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['admin-get-lab-sets', input.labSetId],
    queryFn: async () => {
      return adminGetLabSets(oystehrZambda!, input);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec staletime
  });
};

export const useAdminAddLabSet = (): UseMutationResult<AdminAddLabSetOutput, Error, AdminAddLabSetInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-add-lab-set'],
    mutationFn: async (input: AdminAddLabSetInput) => {
      console.log('mutation for add in house lab called');
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      return adminAddLabSet(oystehrZambda!, input);
    },
    onSuccess: async (_data, _variables) => {
      // invalidate so the list page re-loads correctly
      await queryClient.invalidateQueries({
        queryKey: ['admin-get-lab-sets'],
      });
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      let message = 'Something went wrong! Lab set could not be created :(';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminUpdateLabSet = (labSetId: string): UseMutationResult<void, Error, AdminUpdateLabSetInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-update-lab-set', labSetId],
    mutationFn: async (input: AdminUpdateLabSetInput) => {
      console.log('mutation for update lab set called');
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      return adminUpdateLabSet(oystehrZambda!, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin-get-lab-sets'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['external lab resource search'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['inhouse lab resource search'],
        }),
      ]);
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      let message = 'Something went wrong! The lab set update could not be made.';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminGetLabelPrintingConfig = (
  input: GetLabelPrintingConfigInput
): UseQueryResult<GetLabelPrintingConfigOutput, Error> => {
  const { oystehrZambda } = useApiClients();
  const { deviceId } = input;

  return useQuery({
    queryKey: ['admin-get-label-printing-config', deviceId],
    queryFn: async () => {
      return getLabelPrintingConfig(oystehrZambda!, input);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec staletime
    refetchOnMount: 'always', // refetch every mount
    refetchOnWindowFocus: true, // refetch when you tab back
  });
};

export const useAdminUpdateLabelPrintingConfig = (
  mutatingDeviceId: string | undefined
): UseMutationResult<void, Error, AdminUpdatePrintingConfigInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  console.log('in hook query for update printing config');

  return useMutation({
    mutationKey: ['admin-update-label-printing-config', mutatingDeviceId],
    mutationFn: async (input: AdminUpdatePrintingConfigInput) => {
      console.log('mutation for update printing config');
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      await adminUpdateLabelPrintingConfig(oystehrZambda!, input);
      console.log('finished call to update printing config in hook');
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['admin-get-label-printing-config', variables.deviceId],
      });
      enqueueSnackbar('Successfully updated printing config', { variant: 'success' });
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      let message = 'Something went wrong! Printing config update could not be made.';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminGetSupportDialog = (): UseQueryResult<GetSupportDialogOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['admin-get-support-dialog'],
    queryFn: async () => getSupportDialog(oystehrZambda!),
    enabled: !!oystehrZambda,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
};

export const useAdminUpdateSupportDialog = (): UseMutationResult<void, Error, AdminUpdateSupportDialogInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-update-support-dialog'],
    mutationFn: async (input: AdminUpdateSupportDialogInput) => {
      if (!oystehrZambda) throw new Error('oystehr client is undefined');
      await adminUpdateSupportDialog(oystehrZambda, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-get-support-dialog'] });
      enqueueSnackbar('Support dialog updated', { variant: 'success' });
    },
    onError: (error: any) => {
      safelyCaptureException(error);
      let message = 'Failed to update support dialog.';
      if (isApiError(error)) message = (error as APIError).message;
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useAdminUpdateLocationSupportPhones = (): UseMutationResult<
  void,
  Error,
  AdminUpdateLocationSupportPhonesInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['admin-update-location-support-phones'],
    mutationFn: async (input: AdminUpdateLocationSupportPhonesInput) => {
      if (!oystehrZambda) throw new Error('oystehr client is undefined');
      await adminUpdateLocationSupportPhones(oystehrZambda, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-list'] });
      enqueueSnackbar('Support phone numbers updated', { variant: 'success' });
    },
    onError: (error: any) => {
      safelyCaptureException(error);
      let message = 'Failed to update support phone numbers.';
      if (isApiError(error)) message = (error as APIError).message;
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const usePracticeManagedQuestionnaireCreate = (): UseMutationResult<
  PracticeManagedQuestionnaireCreateOutput,
  Error,
  PracticeManagedQuestionnaireCreateInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['practice-managed-questionnaire-create'],
    mutationFn: async (input: PracticeManagedQuestionnaireCreateInput) => {
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      return practiceManagedQuestionnaireCreate(oystehrZambda!, input);
    },
    onSuccess: async (_data, _variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['practice-managed-questionnaire-list'],
      });
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      const message = getApiError({ error, defaultError: 'Failed to create this Questionnaire.' });
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};

export const useGetPracticeManagedQuestionnaireDetail = (
  input: PracticeManagedQuestionnaireDetailInput
): UseQueryResult<PracticeManagedQuestionnaireDetailOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['practice-managed-questionnaire-detail', input.questionnaireId],
    queryFn: async () => {
      return practiceManagedQuestionnaireList(oystehrZambda!, input);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec
  });
};

export const usePracticeManagedQuestionnaireList = (): UseQueryResult<
  PracticeManagedQuestionnaireListOutput,
  Error
> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['practice-managed-questionnaire-list'],
    queryFn: async () => {
      return practiceManagedQuestionnaireList(oystehrZambda!);
    },
    enabled: !!oystehrZambda,
    staleTime: 30_000, // 30 sec
  });
};

export const usePracticeManagedQuestionnaireUpdate = (
  questionnaireId?: string
): UseMutationResult<PracticeManagedQuestionnaireUpdateOutput, Error, PracticeManagedQuestionnaireUpdateInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['practice-managed-questionnaire-update', questionnaireId],
    mutationFn: async (input: PracticeManagedQuestionnaireUpdateInput) => {
      if (!oystehrZambda) {
        throw new Error('oystehr client is undefined');
      }
      return practiceManagedQuestionnaireUpdate(oystehrZambda!, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['practice-managed-questionnaire-list'],
        }),
      ]);
    },
    onError: (error: any) => {
      // send to sentry
      safelyCaptureException(error);
      let message = 'Failed to update questionnaire.';
      if (isApiError(error)) {
        message = (error as APIError).message;
      }
      enqueueSnackbar(message, { variant: 'error' });
    },
  });
};
