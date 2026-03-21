import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ChargeItemDefinition } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import { ChargeMasterDesignation } from 'utils';
import {
  cmAddProcedureCode,
  CmAddProcedureCodeInput,
  cmAssociatePayer,
  CmAssociatePayerInput,
  cmBulkAddProcedureCodes,
  CmBulkAddProcedureCodesInput,
  cmDeleteProcedureCode,
  CmDeleteProcedureCodeInput,
  cmDisassociatePayer,
  cmUpdateProcedureCode,
  CmUpdateProcedureCodeInput,
  createChargeMaster,
  CreateChargeMasterInput,
  designateChargeMasterEntry,
  DesignateChargeMasterEntryInput,
  getChargeMasterEntry,
  GetChargeMasterEntryResponse,
  listChargeMasters,
  updateChargeMaster,
  UpdateChargeMasterInput,
} from './charge-master.api';

export const useListChargeMastersQuery = (): UseQueryResult<ChargeItemDefinition[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['charge-masters'],

    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return listChargeMasters(oystehrZambda);
    },

    enabled: !!oystehrZambda,
  });
};

export const useGetChargeMasterEntryQuery = (
  designation: ChargeMasterDesignation | undefined,
  payerOrganizationId?: string
): UseQueryResult<GetChargeMasterEntryResponse, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['charge-master-entry', designation, payerOrganizationId],

    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      if (!designation) throw new Error('Designation is required');

      return getChargeMasterEntry(oystehrZambda, { designation, payerOrganizationId });
    },

    enabled: !!oystehrZambda && !!designation,
  });
};

export const useCreateChargeMasterMutation = (): UseMutationResult<any, Error, CreateChargeMasterInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['create-charge-master'],

    mutationFn: async (data: CreateChargeMasterInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return createChargeMaster(oystehrZambda, data);
    },
  });
};

export const useUpdateChargeMasterMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  UpdateChargeMasterInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['update-charge-master'],

    mutationFn: async (data: UpdateChargeMasterInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return updateChargeMaster(oystehrZambda, data);
    },
  });
};

export const useDesignateChargeMasterEntryMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  DesignateChargeMasterEntryInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['designate-charge-master-entry'],

    mutationFn: async (data: DesignateChargeMasterEntryInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return designateChargeMasterEntry(oystehrZambda, data);
    },
  });
};

export const useCmAssociatePayerMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  CmAssociatePayerInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['cm-associate-payer'],

    mutationFn: async (data: CmAssociatePayerInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return cmAssociatePayer(oystehrZambda, data);
    },
  });
};

export const useCmDisassociatePayerMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  CmAssociatePayerInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['cm-disassociate-payer'],

    mutationFn: async (data: CmAssociatePayerInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return cmDisassociatePayer(oystehrZambda, data);
    },
  });
};

export const useCmAddProcedureCodeMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  CmAddProcedureCodeInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['cm-add-procedure-code'],

    mutationFn: async (data: CmAddProcedureCodeInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return cmAddProcedureCode(oystehrZambda, data);
    },
  });
};

export const useCmUpdateProcedureCodeMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  CmUpdateProcedureCodeInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['cm-update-procedure-code'],

    mutationFn: async (data: CmUpdateProcedureCodeInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return cmUpdateProcedureCode(oystehrZambda, data);
    },
  });
};

export const useCmDeleteProcedureCodeMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  CmDeleteProcedureCodeInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['cm-delete-procedure-code'],

    mutationFn: async (data: CmDeleteProcedureCodeInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return cmDeleteProcedureCode(oystehrZambda, data);
    },
  });
};

export const useCmBulkAddProcedureCodesMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  CmBulkAddProcedureCodesInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['cm-bulk-add-procedure-codes'],

    mutationFn: async (data: CmBulkAddProcedureCodesInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return cmBulkAddProcedureCodes(oystehrZambda, data);
    },
  });
};
