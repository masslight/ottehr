import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { chooseJson, PromiseReturnType, useSuccessQuery } from 'utils';
import { useApiClients } from './useAppClients';

interface GetPaymentMethodsParams {
  setupCompleted: boolean;
  beneficiaryPatientId: string | undefined;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>> | null) => void;
}

export const useGetPaymentMethods = (
  input: GetPaymentMethodsParams
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>, Error> => {
  const { beneficiaryPatientId, setupCompleted, onSuccess } = input;
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['payment-methods-list', beneficiaryPatientId],

    queryFn: async () => {
      if (oystehrZambda) {
        const result = await oystehrZambda.zambda.execute({
          id: 'payment-methods-list',
          beneficiaryPatientId,
        });
        return chooseJson<PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>>(result);
      }
      throw new Error('zambda client not defined');
    },

    enabled: Boolean(beneficiaryPatientId) && setupCompleted && Boolean(oystehrZambda),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
