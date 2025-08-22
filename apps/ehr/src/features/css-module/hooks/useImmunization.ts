import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AdministerImmunizationOrderRequest,
  CancelImmunizationOrderRequest,
  chooseJson,
  CreateUpdateImmunizationOrderRequest,
  CreateUpdateImmunizationOrderResponse,
  GetImmunizationOrdersRequest,
  GetImmunizationOrdersResponse,
} from 'utils';

const GET_IMMUNIZATION_ORDERS_KEY = 'get-immunization-orders';

export const useCreateUpdateImmunizationOrder = (): UseMutationResult<
  CreateUpdateImmunizationOrderResponse,
  Error,
  CreateUpdateImmunizationOrderRequest
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUpdateImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'create-update-immunization-order',
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

export const useAdministerImmunizationOrder = (): UseMutationResult<
  CreateUpdateImmunizationOrderResponse,
  Error,
  AdministerImmunizationOrderRequest
> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdministerImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'administer-immunization-order',
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

export const useGetImmunizationOrders = (
  input: GetImmunizationOrdersRequest
): UseQueryResult<GetImmunizationOrdersResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_IMMUNIZATION_ORDERS_KEY, input],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'get-immunization-orders',
      });
      return chooseJson(response);
    },
    enabled: oystehrZambda && Boolean(input.orderId || input.patientId),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCancelImmunizationOrder = (): UseMutationResult<void, Error, CancelImmunizationOrderRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'cancel-immunization-order',
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
