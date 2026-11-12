import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { orderPrescription } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import { OrderPrescriptionInput, OrderPrescriptionOutput } from 'utils/lib/types/api/order-prescription.types';

export const useOrderPrescription = (): UseMutationResult<OrderPrescriptionOutput, Error, OrderPrescriptionInput> => {
  const token = useAuthToken();

  return useMutation({
    mutationFn: async (input: OrderPrescriptionInput) => {
      if (!token) {
        throw new Error('API client not available');
      }
      return orderPrescription(token, input);
    },
  });
};
