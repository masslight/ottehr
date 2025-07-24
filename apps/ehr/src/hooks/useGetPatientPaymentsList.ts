import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ListPatientPaymentInput, ListPatientPaymentResponse, PromiseReturnType } from 'utils';
import { useApiClients } from './useAppClients';

interface GetPatientPaymentsInput extends ListPatientPaymentInput {
  disabled?: boolean;
  onSuccess?: (data: PromiseReturnType<Promise<ListPatientPaymentResponse>>) => void;
}

export const useGetPatientPaymentsList = (
  input: GetPatientPaymentsInput
): UseQueryResult<ListPatientPaymentResponse, Error> => {
  const { oystehrZambda } = useApiClients();
  const { patientId, encounterId, disabled, onSuccess } = input;

  const queryResult = useQuery({
    queryKey: [`patient-payments-list?patient=${patientId}&encounter=${encounterId ?? ''}`, patientId, encounterId],

    queryFn: async (): Promise<ListPatientPaymentResponse> => {
      if (oystehrZambda && patientId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'patient-payments-list',
          patientId,
          encounterId,
        });
        return result.output as ListPatientPaymentResponse;
      }

      throw new Error('api client not defined or patient id is not provided');
    },

    enabled: Boolean(patientId) && Boolean(oystehrZambda) && !disabled,
  });

  useEffect(() => {
    if (queryResult.data && onSuccess) {
      onSuccess(queryResult.data);
    }
  }, [queryResult.data, onSuccess]);

  return queryResult;
};
