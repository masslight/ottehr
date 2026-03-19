import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ChargeItemDefinition } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  createFeeSchedule,
  CreateFeeScheduleInput,
  designateChargeMaster,
  DesignateChargeMasterInput,
  listFeeSchedules,
  updateFeeSchedule,
  UpdateFeeScheduleInput,
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

export const useDesignateChargeMasterMutation = (): UseMutationResult<
  ChargeItemDefinition,
  Error,
  DesignateChargeMasterInput
> => {
  const { oystehrZambda } = useApiClients();

  return useMutation({
    mutationKey: ['designate-charge-master'],

    mutationFn: async (data: DesignateChargeMasterInput) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');

      return designateChargeMaster(oystehrZambda, data);
    },
  });
};
