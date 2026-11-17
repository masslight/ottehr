import { QueryKey, useQuery, UseQueryResult } from '@tanstack/react-query';
import { getMedicationInventory, listMedicationInventory } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  GetMedicationInventoryResponse,
  InventoryLot,
  ListMedicationInventoryInput,
  ListMedicationInventoryResponse,
} from 'utils/lib/types/api/config/in-house-medications';

export const INVENTORY_QUERY_KEY = 'medication-inventory';

export const useMedicationInventory = (
  view: ListMedicationInventoryInput | undefined
): UseQueryResult<ListMedicationInventoryResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [INVENTORY_QUERY_KEY, view],
    queryFn: () => listMedicationInventory(oystehrZambda!, view!),
    enabled: !!oystehrZambda && !!view,
  });
};

export const useLotHistory = (lotId: string): UseQueryResult<ListMedicationInventoryResponse, Error> =>
  useMedicationInventory({ view: 'lot-history', lotId });

export const useInventoryLotsOnHand = ({
  catalogMedicationId,
  locationId,
  enabled = true,
}: {
  catalogMedicationId: string | undefined;
  locationId: string | undefined;
  enabled?: boolean;
}): UseQueryResult<InventoryLot[]> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['medication-inventory-lots-on-hand', catalogMedicationId, locationId],
    queryFn: async () => {
      const { lots } = await getMedicationInventory(oystehrZambda!, {
        medicationId: catalogMedicationId!,
        locationId: locationId!,
      });
      return lots ?? [];
    },
    enabled: Boolean(oystehrZambda && catalogMedicationId && locationId && enabled),
  });
};

export const recordedInventoryQueryKey = (medicationId: string | undefined): QueryKey => [
  'medication-inventory-recorded',
  medicationId,
];

export const useHasRecordedInventory = (
  medicationId: string | undefined,
  enabled: boolean
): UseQueryResult<boolean> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: recordedInventoryQueryKey(medicationId),
    queryFn: async ({ client, queryKey }) =>
      Boolean((await getMedicationInventory(oystehrZambda!, { medicationId: medicationId! })).lastReceivedLot) ||
      client.getQueryData<boolean>(queryKey) === true,
    enabled: Boolean(oystehrZambda && medicationId && enabled),
  });
};

export const useLastReceivedLot = (
  medicationId: string
): UseQueryResult<GetMedicationInventoryResponse['lastReceivedLot'] | null> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: ['medication-inventory-last-received-lot', medicationId],
    queryFn: async () => (await getMedicationInventory(oystehrZambda!, { medicationId })).lastReceivedLot ?? null,
    enabled: !!oystehrZambda,
    gcTime: 0,
  });
};
