import { useQuery } from 'react-query';
import { ListPatientPaymentInput, ListPatientPaymentResponse, PromiseReturnType } from 'utils';
import { useApiClients } from './useAppClients';

interface GetPatientPaymentsInput extends ListPatientPaymentInput {
  disabled?: boolean;
  onSuccess?: (data: PromiseReturnType<Promise<ListPatientPaymentResponse>>) => void;
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPatientPaymentsList = (input: GetPatientPaymentsInput) => {
  const { oystehrZambda } = useApiClients();
  const { patientId, encounterId, disabled, onSuccess } = input;

  return useQuery(
    [`patient-payments-list?patient=${patientId}&encounter=${encounterId ?? ''}`, patientId, encounterId],
    async () => {
      if (oystehrZambda && patientId) {
        const result = await oystehrZambda.zambda.execute({
          id: 'patient-payments-list',
          patientId,
          encounterId,
        });
        return result.output;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    {
      enabled: Boolean(patientId) && Boolean(oystehrZambda) && !disabled,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get payment methods: ', err);
      },
    }
  );
};
