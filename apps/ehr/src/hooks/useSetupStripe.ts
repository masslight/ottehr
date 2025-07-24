import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chooseJson } from 'utils';
import { useApiClients } from './useAppClients';

export const useSetupStripe = (
  beneficiaryPatientId: string | undefined,
  onSuccess?: (data: string) => void
): UseQueryResult<string, Error> => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['setup-payment-method', beneficiaryPatientId],

    queryFn: async (): Promise<string> => {
      if (!oystehrZambda) {
        throw new Error('zambda client not defined');
      }

      if (!beneficiaryPatientId) {
        throw new Error('beneficiary patient id not defined');
      }

      const result = await oystehrZambda.zambda.execute({
        id: 'setup-payment-method',
        beneficiaryPatientId,
      });
      return chooseJson<string>(result);
    },

    enabled: Boolean(oystehrZambda && beneficiaryPatientId),
  });

  useEffect(() => {
    if (queryResult.data && onSuccess) {
      onSuccess(queryResult.data);
    }
  }, [queryResult.data, onSuccess]);

  return queryResult;
};
