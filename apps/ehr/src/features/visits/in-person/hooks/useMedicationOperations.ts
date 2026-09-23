import { useQueryClient } from '@tanstack/react-query';
import {
  ExtendedMedicationDataForResponse,
  GetMedicationOrdersInput,
  UpdateMedicationOrderInput,
} from 'utils/lib/types/api/medication-administration.types';
import { invalidateChartSections } from '../../shared/hooks/chartSectionCache';
import {
  useCreateUpdateMedicationOrder,
  useGetMedicationOrders,
} from '../../shared/stores/appointment/appointment.queries';
import { useAppointmentData } from '../../shared/stores/appointment/appointment.store';

interface MedicationAPI {
  medications: ExtendedMedicationDataForResponse[];
  cancelledMedications: ExtendedMedicationDataForResponse[];
  isLoading: boolean;
  loadMedications: () => Promise<void>;
  updateMedication: (updatedMedication: UpdateMedicationOrderInput) => Promise<{ id: string; message: string }>;
  deleteMedication: (idsToDelete: string) => Promise<void>;
}

const emptyArray: ExtendedMedicationDataForResponse[] = [];

export const useMedicationAPI = (): MedicationAPI => {
  const { encounter } = useAppointmentData();
  const queryClient = useQueryClient();
  const { mutateAsync: createUpdateMedicationOrder } = useCreateUpdateMedicationOrder();
  const searchBy: GetMedicationOrdersInput['searchBy'] = { field: 'encounterId', value: encounter.id || '' };
  const { data: medicationsData, isLoading } = useGetMedicationOrders(searchBy);

  const invalidateCache = async (): Promise<void> => {
    const encounterId = encounter.id;
    if (!encounterId) return;

    // Invalidate MAR data (get-medication-orders)
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const [prefix, searchByString] = query.queryKey as [string, string?];
        if (prefix !== 'telemed-get-medication-orders' || !searchByString) return false;

        try {
          const searchBy = JSON.parse(searchByString);
          return (
            (searchBy.field === 'encounterId' && searchBy.value === encounterId) ||
            (searchBy.field === 'encounterIds' && Array.isArray(searchBy.value) && searchBy.value.includes(encounterId))
          );
        } catch {
          return false;
        }
      },
    });

    // The medication history is the history section, and create-update-medication-order adds billing codes,
    // which are the assessment section: re-read both where they are shown.
    await invalidateChartSections(queryClient, encounterId, ['history', 'assessment']);
  };

  return {
    medications: medicationsData?.orders || emptyArray,
    cancelledMedications: medicationsData?.cancelledOrders || emptyArray,
    isLoading,
    loadMedications: invalidateCache,
    updateMedication: async (updatedMedication: UpdateMedicationOrderInput) => {
      const data = await createUpdateMedicationOrder(updatedMedication, {
        onSuccess: invalidateCache,
      });
      return data;
    },
    deleteMedication: async (idToDelete) => {
      await createUpdateMedicationOrder(
        { orderId: idToDelete, newStatus: 'cancelled' },
        { onSuccess: invalidateCache }
      );
    },
  };
};
