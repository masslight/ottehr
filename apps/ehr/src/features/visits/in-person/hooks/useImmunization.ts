import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Identifier, Medication } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AdministerImmunizationOrderRequest,
  CancelImmunizationOrderRequest,
  chooseJson,
  CreateUpdateImmunizationOrderRequest,
  CreateUpdateImmunizationOrderResponse,
  GetImmunizationOrdersRequest,
  GetImmunizationOrdersResponse,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils';

const GET_IMMUNIZATION_ORDERS_KEY = 'get-immunization-orders';
const GET_VACCINES_KEY = 'get-vaccines';

export interface Vaccine {
  id: string;
  name: string;
}

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
    enabled: oystehrZambda && Boolean(input.orderId || input.patientId || input.encounterId),
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

export const useGetVaccines = (): UseQueryResult<Vaccine[], Error> => {
  const { oystehr } = useApiClients();
  return useQuery({
    queryKey: [GET_VACCINES_KEY],
    queryFn: async () => {
      if (!oystehr) throw new Error('oystehr not defined');
      const data = await oystehr.fhir.search<Medication>({
        resourceType: 'Medication',
        params: [{ name: 'identifier', value: INVENTORY_VACCINE_TYPE_CODE }],
      });
      return data.unbundle().flatMap((medication) => {
        const identifier = medication.identifier?.find(
          (identifier: Identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM
        );
        if (identifier?.value && medication.id) {
          return [
            {
              id: medication.id,
              name: identifier?.value,
            },
          ];
        }
        return [];
      });
    },
    enabled: oystehr != null,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
