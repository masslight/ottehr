import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  AdministerImmunizationOrderRequest,
  CancelImmunizationOrderRequest,
  CancelImmunizationOrderResponse,
  CreateUpdateImmunizationOrderRequest,
  CreateUpdateImmunizationOrderResponse,
  GetImmunizationOrdersRequest,
  GetImmunizationOrdersResponse,
  GetVaccinesResponse,
  Vaccine,
} from 'utils/lib/types/data/immunization/types';
import { invalidateChartSections } from '../../shared/hooks/chartSectionCache';

const GET_IMMUNIZATION_ORDERS_KEY = 'get-immunization-orders';
const GET_VACCINES_KEY = 'get-vaccines';

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
    enabled: oystehrZambda && Boolean(input.orderId || input.patientId || input.encounterIds),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCancelImmunizationOrder = (
  encounterId: string | undefined
): UseMutationResult<CancelImmunizationOrderResponse, Error, CancelImmunizationOrderRequest> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelImmunizationOrderRequest) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        ...input,
        id: 'cancel-immunization-order',
      });
      return chooseJson<CancelImmunizationOrderResponse>(response);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [GET_IMMUNIZATION_ORDERS_KEY],
        exact: false,
      });
      await invalidateChartSections(queryClient, encounterId, ['assessment']);
    },
  });
};

export const useGetVaccines = (): UseQueryResult<Vaccine[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [GET_VACCINES_KEY],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        id: 'get-vaccines',
      });
      return (chooseJson(response) as GetVaccinesResponse).vaccines;
    },
    enabled: oystehrZambda != null,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
