import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { PaymentMethodSetupZambdaOutput, useSuccessQuery } from 'utils';
import { chooseJson } from 'utils';
import { useApiClients } from './useAppClients';

export const useSetupStripe = (
  beneficiaryPatientId: string | undefined,
  appointmentId: string | undefined,
  onSuccess?: (data: PaymentMethodSetupZambdaOutput | null) => void
): UseQueryResult<PaymentMethodSetupZambdaOutput, Error> => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['payment-methods-setup', beneficiaryPatientId],

    queryFn: async (): Promise<PaymentMethodSetupZambdaOutput> => {
      if (!oystehrZambda) {
        throw new Error('zambda client not defined');
      }

      if (!beneficiaryPatientId) {
        throw new Error('beneficiary patient id not defined');
      }

      const result = await oystehrZambda.zambda.execute({
        id: 'payment-methods-setup',
        beneficiaryPatientId,
        appointmentId,
      });

      return chooseJson<PaymentMethodSetupZambdaOutput>(result);
    },

    enabled: Boolean(oystehrZambda && beneficiaryPatientId && appointmentId),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
