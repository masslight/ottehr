import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getMedicationInventory } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';

/** Lots of a catalog drug with stock on hand at the visit's clinic, for the Lot field's suggestions. */
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
