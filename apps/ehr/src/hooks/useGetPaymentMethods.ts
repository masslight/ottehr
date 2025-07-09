import { useQuery } from 'react-query';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';
import { useApiClients } from './useAppClients';

interface GetPaymentMethodsParams {
  setupCompleted: boolean;
  beneficiaryPatientId: string | undefined;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>) => void;
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPaymentMethods = (input: GetPaymentMethodsParams) => {
  const { oystehrZambda } = useApiClients();
  const { beneficiaryPatientId, setupCompleted, onSuccess } = input;

  return useQuery(
    ['payment-methods', beneficiaryPatientId],
    async () => {
      if (oystehrZambda && beneficiaryPatientId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'payment-methods-list',
          beneficiaryPatientId,
        });
        return result.output;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    {
      enabled: Boolean(beneficiaryPatientId) && setupCompleted && Boolean(oystehrZambda),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get payment methods: ', err);
      },
    }
  );
};
