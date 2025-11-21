import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useSuccessQuery } from 'utils';
import { chooseJson } from 'utils';
import { useApiClients } from './useAppClients';

export const useSetupStripe = (
  beneficiaryPatientId: string | undefined,
  onSuccess?: (data: string | null) => void
): UseQueryResult<string, Error> => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['payment-methods-setup', beneficiaryPatientId],

    queryFn: async (): Promise<string> => {
      if (!oystehrZambda) {
        throw new Error('zambda client not defined');
      }

      if (!beneficiaryPatientId) {
        throw new Error('beneficiary patient id not defined');
      }

      const result = await oystehrZambda.zambda.execute({
        id: 'payment-methods-setup',
        beneficiaryPatientId,
      });
      return chooseJson<string>(result);
    },

    enabled: Boolean(oystehrZambda && beneficiaryPatientId),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
