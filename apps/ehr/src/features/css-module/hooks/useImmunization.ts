import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  CancelImmunizationOrderInput,
  chooseJson,
  CreateUpdateImmunizationOrderInput,
  GetImmunizationOrdersInput,
  ImmunizationOrder,
} from 'utils';

const GET_IMMUNIZATION_ORDERS_KEY = 'get-immunization-orders';

export const useCreateUpdateImmunizationOrder = (): UseMutationResult<
  void,
  Error,
  CreateUpdateImmunizationOrderInput
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUpdateImmunizationOrderInput) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        id: 'create-update-immunization-order',
        ...input,
      });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
    },
  });
};

/*export const useAdministerImmunizationOrder = (): UseMutationResult<void, Error, AdministerImmunizationOrderInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdministerImmunizationOrderInput) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      return createImmunizationOrder(oystehrZambda, {
        ...input,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
    },
  });
};*/

export const useGetImmunizationOrders = (
  input: GetImmunizationOrdersInput
): UseQueryResult<ImmunizationOrder[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_IMMUNIZATION_ORDERS_KEY, input],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        id: 'get-immunization-orders',
        ...input,
      });
      return chooseJson(response);
    },
    enabled: oystehrZambda && Boolean(input.orderId || input.patientId),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCancelImmunizationOrder = (): UseMutationResult<void, Error, CancelImmunizationOrderInput> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelImmunizationOrderInput) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        id: 'cancel-immunization-order',
        ...input,
      });
      return chooseJson(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
    },
  });
};
