import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { OystehrAPIClient } from 'ui-components';
import { chooseJson, PromiseReturnType } from 'utils';
import { useApiClients } from './useAppClients';

interface GetPaymentMethodsParams {
  setupCompleted: boolean;
  beneficiaryPatientId: string | undefined;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>) => void;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPaymentMethods = (input: GetPaymentMethodsParams) => {
  const { beneficiaryPatientId, setupCompleted, onSuccess } = input;
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['get-payment-methods', beneficiaryPatientId],

    queryFn: async () => {
      if (oystehrZambda) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-payment-methods',
          beneficiaryPatientId,
        });
        return chooseJson<PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>>(result);
      }
      throw new Error('zambda client not defined');
    },

    enabled: Boolean(beneficiaryPatientId) && setupCompleted && Boolean(oystehrZambda),
  });

  useEffect(() => {
    if (queryResult.data && onSuccess) {
      onSuccess(queryResult.data);
    }
  }, [queryResult.data, onSuccess]);

  return queryResult;
};
