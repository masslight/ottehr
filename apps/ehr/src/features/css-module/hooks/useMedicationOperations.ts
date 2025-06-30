import { useQueryClient } from 'react-query';
import { useParams } from 'react-router-dom';
import { ExtendedMedicationDataForResponse, UpdateMedicationOrderInput } from 'utils';
import { useCreateUpdateMedicationOrder, useGetMedicationOrders } from '../../../telemed';

interface MedicationAPI {
  medications: ExtendedMedicationDataForResponse[];
  isLoading: boolean;
  loadMedications: () => Promise<void>;
  updateMedication: (updatedMedication: UpdateMedicationOrderInput) => Promise<{ id: string; message: string }>;
  deleteMedication: (idsToDelete: string) => Promise<void>;
}

const emptyArray: ExtendedMedicationDataForResponse[] = [];

export const useMedicationAPI = (): MedicationAPI => {
  const { id: encounterId } = useParams();
  const queryClient = useQueryClient();
  const { mutateAsync: createUpdateMedicationOrder } = useCreateUpdateMedicationOrder();
  const { data: medications, isLoading } = useGetMedicationOrders({ encounterId });

  const invalidateCache = async (): Promise<void> => {
    return await queryClient.invalidateQueries({
      queryKey: ['telemed-get-medication-orders', encounterId],
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
