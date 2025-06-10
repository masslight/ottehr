import { useMutation } from 'react-query';
import { useApiClients } from './useAppClients';

interface SetDefaultPaymentMethodParams {
  paymentMethodId: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSetDefaultPaymentMethod = (beneficiaryPatientId: string | undefined) => {
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
