import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getMedicationInventory, listMedicationInventory } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  InventoryLot,
  ListMedicationInventoryInput,
  ListMedicationInventoryResponse,
} from 'utils/lib/types/api/config/in-house-medications';

export const INVENTORY_QUERY_KEY = 'medication-inventory';

/** The inventory screen for one location or all of them; `undefined` waits until the view is known. */
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

/** One lot's stock history. */
export const useLotHistory = (lotId: string): UseQueryResult<ListMedicationInventoryResponse, Error> =>
  useMedicationInventory({ view: 'lot-history', lotId });

/** Lots of a catalog drug with stock on hand at the visit's location, for the Lot field's suggestions. */
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
