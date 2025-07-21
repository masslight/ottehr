import { useQueryClient } from '@tanstack/react-query';
import {
  ExtendedMedicationDataForResponse,
  GetMedicationOrdersInput,
  getSelectors,
  UpdateMedicationOrderInput,
} from 'utils';
import { useAppointmentStore, useCreateUpdateMedicationOrder, useGetMedicationOrders } from '../../../telemed';

interface MedicationAPI {
  medications: ExtendedMedicationDataForResponse[];
  isLoading: boolean;
  loadMedications: () => Promise<void>;
  updateMedication: (updatedMedication: UpdateMedicationOrderInput) => Promise<{ id: string; message: string }>;
  deleteMedication: (idsToDelete: string) => Promise<void>;
}

const emptyArray: ExtendedMedicationDataForResponse[] = [];

export const useMedicationAPI = (): MedicationAPI => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const queryClient = useQueryClient();
  const { mutateAsync: createUpdateMedicationOrder } = useCreateUpdateMedicationOrder();

  const searchBy: GetMedicationOrdersInput['searchBy'] = { field: 'encounterId', value: encounter.id || '' };

  const { data: medications, isLoading } = useGetMedicationOrders(searchBy);

  const invalidateCache = async (): Promise<void> => {
    return await queryClient.invalidateQueries({
      queryKey: ['telemed-get-medication-orders', JSON.stringify(searchBy)],
      // 'exact: false' is used for ignoring other cache keys (apiClient)
      exact: false,
    });
  };

  return {
    medications: medications?.orders || emptyArray,
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
