import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useInventoryLotsOnHand, useMedicationInventory } from 'src/features/admin/inventory/inventory.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { InventoryDrugRow, InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { VfcEligibilityResponse } from 'utils/lib/types/api/vfc-eligibility';
import { VfcEligibilityCode } from 'utils/lib/types/data/immunization/vfc';

// The order screen's and the Vaccine Details card's reads of inventory and VFC eligibility, in one module so
// tests of those screens mock one thing.

const VFC_ELIGIBILITY_KEY = 'vfc-eligibility';

/** The visit's VFC eligibility: what the paperwork says and what staff confirmed. */
export const useVfcEligibility = (encounterId: string | undefined): UseQueryResult<VfcEligibilityResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [VFC_ELIGIBILITY_KEY, encounterId],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({ id: 'vfc-eligibility', action: 'get', encounterId });
      return chooseJson(response) as VfcEligibilityResponse;
    },
    enabled: Boolean(oystehrZambda && encounterId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useConfirmVfcEligibility = (
  encounterId: string | undefined
): UseMutationResult<VfcEligibilityResponse, Error, VfcEligibilityCode> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: VfcEligibilityCode) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      const response = await oystehrZambda.zambda.execute({
        id: 'vfc-eligibility',
        action: 'confirm',
        encounterId,
        code,
      });
      return chooseJson(response) as VfcEligibilityResponse;
    },
    onSuccess: (data) => queryClient.setQueryData([VFC_ELIGIBILITY_KEY, encounterId], data),
  });
};

/**
 * Every vaccine's lots at the visit's location, for the Due today box; undefined until read (the box then treats
 * the practice's vaccine list as the stock). The browser's date decides "expired", as it does on the MAR.
 */
export const useVaccineInventoryAtLocation = (
  locationId: string | undefined
): { data: InventoryDrugRow[] | undefined } => {
  const { data } = useMedicationInventory(
    locationId ? { view: 'location', locationId, today: DateTime.now().toISODate() } : undefined
  );
  return { data: data?.drugs.filter((drug) => drug.type === 'vaccine') };
};

/** Lots of the vaccine on hand at the visit's location; empty for a vaccine not set up for inventory. */
export const useVaccineLotsOnHand = (
  catalogMedicationId: string | undefined,
  locationId: string | undefined
): UseQueryResult<InventoryLot[]> => useInventoryLotsOnHand({ catalogMedicationId, locationId });
