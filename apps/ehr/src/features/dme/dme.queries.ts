import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { createDmeOrder, getDmeOrderPdf, getDmeOrders, sendDmeOrderFax, updateDmeOrder } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  CreateDmeOrderInput,
  CreateDmeOrderResponse,
  DmeOrderDTO,
  GetDmeOrderPdfResponse,
  SendDmeOrderFaxInput,
  SendDmeOrderFaxResponse,
  UpdateDmeOrderInput,
  UpdateDmeOrderResponse,
} from 'utils/lib/types/api/dme.types';
import { invalidateChartSections, sectionsForChartFields } from '../visits/shared/hooks/chartSectionCache';

export const DME_ORDERS_QUERY_KEY = 'dme-orders';

export const useDmeOrders = (encounterId: string | undefined): UseQueryResult<DmeOrderDTO[], Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [DME_ORDERS_QUERY_KEY, 'encounter', encounterId],
    queryFn: async () => (await getDmeOrders(oystehrZambda!, { encounterId })).orders,
    enabled: !!oystehrZambda && !!encounterId,
  });
};

export const useDmeOrder = (deviceRequestId: string | undefined): UseQueryResult<DmeOrderDTO | null, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [DME_ORDERS_QUERY_KEY, 'order', deviceRequestId],
    queryFn: async () => (await getDmeOrders(oystehrZambda!, { deviceRequestId })).orders[0] ?? null,
    enabled: !!oystehrZambda && !!deviceRequestId,
  });
};

const useOnDmeOrderChanged = (): ((encounterId: string | undefined) => Promise<void>) => {
  const queryClient = useQueryClient();
  return async (encounterId) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [DME_ORDERS_QUERY_KEY] }),
      invalidateChartSections(queryClient, encounterId, sectionsForChartFields(['cptCodes'])),
    ]);
  };
};

export const useCreateDmeOrder = (): UseMutationResult<CreateDmeOrderResponse, Error, CreateDmeOrderInput> => {
  const { oystehrZambda } = useApiClients();
  const onChanged = useOnDmeOrderChanged();
  return useMutation({
    mutationFn: (input) => createDmeOrder(oystehrZambda!, input),
    onSuccess: (_data, input) => onChanged(input.encounterId),
  });
};

export const useUpdateDmeOrder = (
  encounterId: string | undefined
): UseMutationResult<UpdateDmeOrderResponse, Error, UpdateDmeOrderInput> => {
  const { oystehrZambda } = useApiClients();
  const onChanged = useOnDmeOrderChanged();
  return useMutation({
    mutationFn: (input) => updateDmeOrder(oystehrZambda!, input),
    onSuccess: () => onChanged(encounterId),
  });
};

export const useDmeOrderPdf = (): UseMutationResult<GetDmeOrderPdfResponse, Error, string> => {
  const { oystehrZambda } = useApiClients();
  return useMutation({
    mutationFn: (deviceRequestId) => getDmeOrderPdf(oystehrZambda!, { deviceRequestId }),
  });
};

export const useSendDmeOrderFax = (): UseMutationResult<SendDmeOrderFaxResponse, Error, SendDmeOrderFaxInput> => {
  const { oystehrZambda } = useApiClients();
  return useMutation({
    mutationFn: (input) => sendDmeOrderFax(oystehrZambda!, input),
  });
};
