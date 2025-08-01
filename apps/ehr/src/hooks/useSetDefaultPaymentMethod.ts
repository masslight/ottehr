import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { useApiClients } from './useAppClients';

interface SetDefaultPaymentMethodParams {
  paymentMethodId: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export const useSetDefaultPaymentMethod = (
  beneficiaryPatientId: string | undefined
): UseMutationResult<void, Error, SetDefaultPaymentMethodParams> => {
  const { oystehrZambda: oystehr } = useApiClients();

  return useMutation({
    mutationFn: async ({ paymentMethodId, onSuccess, onError }: SetDefaultPaymentMethodParams) => {
      if (oystehr && beneficiaryPatientId) {
        return oystehr.zambda
          .execute({
            id: 'payment-methods-set-default',
            beneficiaryPatientId,
            paymentMethodId,
          })
          .then(() => {
            if (onSuccess) {
              onSuccess();
            }
          })
          .catch((error) => {
            if (onError) {
              onError(error);
            }
          });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    retry: 2,
    retryDelay: 1000,
  });
};
