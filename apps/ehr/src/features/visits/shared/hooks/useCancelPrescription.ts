import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { cancelPrescription } from 'src/api/api';
import { useAuthToken } from 'src/hooks/useAuthToken';
import { CancelPrescriptionInput, CancelPrescriptionOutput } from 'utils/lib/types/api/order-prescription.types';

export const useCancelPrescription = (): UseMutationResult<
  CancelPrescriptionOutput,
  Error,
  CancelPrescriptionInput
> => {
  const token = useAuthToken();

  return useMutation({
    mutationFn: async (input: CancelPrescriptionInput) => {
      if (!token) {
        throw new Error('Please reload and try again.');
      }
      return cancelPrescription(token, input);
    },
  });
};
