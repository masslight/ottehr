import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ChargeItemDefinition } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  addProcedureCode,
  AddProcedureCodeInput,
  associatePayer,
  AssociatePayerInput,
  bulkAddProcedureCodes,
  BulkAddProcedureCodesInput,
  createFeeSchedule,
  CreateFeeScheduleInput,
  deleteProcedureCode,
  DeleteProcedureCodeInput,
  disassociatePayer,
  listFeeSchedules,
  updateFeeSchedule,
  UpdateFeeScheduleInput,
  updateProcedureCode,
  UpdateProcedureCodeInput,
} from './fee-schedule.api';

export const useListFeeSchedulesQuery = (): UseQueryResult<ChargeItemDefinition[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['fee-schedules'],

    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return listFeeSchedules(oystehrZambda);
    },

    enabled: !!oystehrZambda,
  });
};

export const useCreateFeeScheduleMutation = (): UseMutationResult<any, Error, CreateFeeScheduleInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['create-fee-schedule'],

    mutationFn: async (data: CreateFeeScheduleInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return createFeeSchedule(oystehrZambda, data);
    },
  });
};

export const useUpdateFeeScheduleMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  UpdateFeeScheduleInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['update-fee-schedule'],

    mutationFn: async (data: UpdateFeeScheduleInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return updateFeeSchedule(oystehrZambda, data);
    },
  });
};

export const useAssociatePayerMutation = (): UseMutationResult<ChargeItemDefinition, Error, AssociatePayerInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['associate-payer'],

    mutationFn: async (data: AssociatePayerInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return associatePayer(oystehrZambda, data);
    },
  });
};

export const useDisassociatePayerMutation = (): UseMutationResult<ChargeItemDefinition, Error, AssociatePayerInput> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['disassociate-payer'],

    mutationFn: async (data: AssociatePayerInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return disassociatePayer(oystehrZambda, data);
    },
  });
};

export const useAddProcedureCodeMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  AddProcedureCodeInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['add-procedure-code'],

    mutationFn: async (data: AddProcedureCodeInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return addProcedureCode(oystehrZambda, data);
    },
  });
};

export const useUpdateProcedureCodeMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  UpdateProcedureCodeInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['update-procedure-code'],

    mutationFn: async (data: UpdateProcedureCodeInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return updateProcedureCode(oystehrZambda, data);
    },
  });
};

export const useDeleteProcedureCodeMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  DeleteProcedureCodeInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['delete-procedure-code'],

    mutationFn: async (data: DeleteProcedureCodeInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return deleteProcedureCode(oystehrZambda, data);
    },
  });
};

export const useBulkAddProcedureCodesMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  BulkAddProcedureCodesInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['bulk-add-procedure-codes'],

    mutationFn: async (data: BulkAddProcedureCodesInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return bulkAddProcedureCodes(oystehrZambda, data);
    },
  });
};
