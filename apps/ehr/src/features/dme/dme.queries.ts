import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  createDmeMenuItem,
  createDmeOrder,
  deleteDmeMenuItem,
  getDmeMenuItems,
  getDmeOrderPdf,
  getDmeOrders,
  updateDmeMenuItem,
  updateDmeOrder,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  CreateDmeOrderInput,
  CreateDmeOrderResponse,
  DeleteDmeMenuItemInput,
  DmeMenuItemInput,
  DmeOrderDTO,
  GetDmeMenuItemsResponse,
  GetDmeOrderPdfResponse,
  SaveDmeMenuItemResponse,
  UpdateDmeMenuItemInput,
  UpdateDmeOrderInput,
  UpdateDmeOrderResponse,
} from 'utils/lib/types/api/dme.types';
import { invalidateChartSections, sectionsForChartFields } from '../visits/shared/hooks/chartSectionCache';

export const DME_MENU_ITEMS_QUERY_KEY = 'dme-menu-items';
export const DME_ORDERS_QUERY_KEY = 'dme-orders';

export const useDmeMenuItems = (): UseQueryResult<GetDmeMenuItemsResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [DME_MENU_ITEMS_QUERY_KEY],
    queryFn: () => getDmeMenuItems(oystehrZambda!),
    enabled: !!oystehrZambda,
  });
};

const useInvalidateDmeMenu = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [DME_MENU_ITEMS_QUERY_KEY] });
};

export const useCreateDmeMenuItem = (): UseMutationResult<SaveDmeMenuItemResponse, Error, DmeMenuItemInput> => {
  const { oystehrZambda } = useApiClients();
  const invalidate = useInvalidateDmeMenu();
  return useMutation({
    mutationFn: (input) => createDmeMenuItem(oystehrZambda!, input),
    onSuccess: invalidate,
  });
};

export const useUpdateDmeMenuItem = (): UseMutationResult<SaveDmeMenuItemResponse, Error, UpdateDmeMenuItemInput> => {
  const { oystehrZambda } = useApiClients();
  const invalidate = useInvalidateDmeMenu();
  return useMutation({
    mutationFn: (input) => updateDmeMenuItem(oystehrZambda!, input),
    onSuccess: invalidate,
  });
};

export const useDeleteDmeMenuItem = (): UseMutationResult<void, Error, DeleteDmeMenuItemInput> => {
  const { oystehrZambda } = useApiClients();
  const invalidate = useInvalidateDmeMenu();
  return useMutation({
    mutationFn: (input) => deleteDmeMenuItem(oystehrZambda!, input),
    onSuccess: invalidate,
  });
};

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
