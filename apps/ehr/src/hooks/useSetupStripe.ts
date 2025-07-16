import { useQuery, UseQueryResult } from 'react-query';
import { OystehrAPIClient } from 'ui-components';
import { PromiseReturnType } from 'utils';
import { useApiClients } from './useAppClients';

export const useSetupStripe = (
  beneficiaryPatientId: string | undefined,
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['setupPaymentMethod']>>) => void
): UseQueryResult<string | undefined, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery(
    [`setup-payment-method/${beneficiaryPatientId}`, beneficiaryPatientId],
    async () => {
      if (oystehrZambda && beneficiaryPatientId) {
        const data = await oystehrZambda.zambda.execute({
          id: 'payment-methods-setup',
          beneficiaryPatientId,
        });
        if (onSuccess) {
          onSuccess(data.output as string);
        }
        return data.output as string;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    {
      enabled: Boolean(oystehrZambda && beneficiaryPatientId),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching setup payment method: ', err);
      },
    }
  );
};
