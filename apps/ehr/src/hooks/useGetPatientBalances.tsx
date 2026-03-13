import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { OystehrAPIClient } from 'ui-components';
import { chooseJson, PromiseReturnType, useSuccessQuery } from 'utils';
import { useApiClients } from './useAppClients';

interface GetPatientBalancesParams {
  patientId: string | undefined;
  disabled?: boolean;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPatientBalances']>> | null) => void;
}

export const useGetPatientBalances = (
  input: GetPatientBalancesParams
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPatientBalances']>>, Error> => {
  const { patientId, disabled, onSuccess } = input;
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['get-patient-balances', patientId],

    queryFn: async () => {
      if (oystehrZambda) {
        const result = await oystehrZambda.zambda.execute({
          id: 'get-patient-balances',
          patientId,
        });
        return chooseJson<PromiseReturnType<ReturnType<OystehrAPIClient['getPatientBalances']>>>(result);
      }
      throw new Error('zambda client not defined');
    },

    enabled: Boolean(patientId) && Boolean(oystehrZambda) && !disabled,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
