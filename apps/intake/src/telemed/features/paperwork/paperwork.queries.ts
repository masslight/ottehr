import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { OystehrAPIClient } from 'ui-components';
import { isNullOrUndefined, PromiseReturnType } from 'utils';
import { useSuccessQuery } from 'utils/lib/frontend';
import { useOystehrAPIClient } from '../../utils';
import { useAppointmentStore } from '../appointments';

export const useGetPaperwork = (
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaperwork']>> | null) => void,
  params?: {
    enabled?: boolean;
    staleTime?: number;
    onError?: (error: any) => void;
  }
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPaperwork']>>, Error> => {
  const apiClient = useOystehrAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  const queryResult = useQuery({
    queryKey: ['paperwork', appointmentID],

    queryFn: () => {
      if (apiClient && appointmentID) {
        return apiClient.getPaperwork({
          appointmentID: appointmentID,
        });
      }

      throw new Error('api client not defined or appointmentID is not provided');
    },

    enabled:
      (params?.enabled && Boolean(apiClient && appointmentID)) ||
      (isNullOrUndefined(params?.enabled) && Boolean(apiClient && appointmentID)),

    staleTime: params?.staleTime,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useUpdatePaperworkMutation = () => {
  return useMutation({
    // todo: figure out what is going on with the ts here
    mutationFn: async ({
      apiClient,
      questionnaireResponseId,
      answers,
    }: {
      apiClient: OystehrAPIClient;
      questionnaireResponseId: string;
      answers: QuestionnaireResponseItem;
    }) => {
      await apiClient.patchPaperwork({
        questionnaireResponseId,
        answers,
      });
    },
  });
};

interface GetPaymentMethodsParams {
  setupCompleted: boolean;
  beneficiaryPatientId: string | undefined;
  appointmentId: string | undefined;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>> | null) => void;
}

export const useGetPaymentMethods = (
  input: GetPaymentMethodsParams
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>, Error> => {
  const apiClient = useOystehrAPIClient();
  const { beneficiaryPatientId, appointmentId, setupCompleted, onSuccess } = input;

  const queryResult = useQuery({
    queryKey: ['payment-methods', beneficiaryPatientId, appointmentId],

    queryFn: () => {
      if (apiClient && beneficiaryPatientId && appointmentId) {
        return apiClient.getPaymentMethods({
          beneficiaryPatientId,
          appointmentId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },

    enabled: Boolean(beneficiaryPatientId) && setupCompleted && Boolean(apiClient) && Boolean(appointmentId),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useSetupPaymentMethod = (
  beneficiaryPatientId: string | undefined,
  appointmentId: string | undefined,
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['setupPaymentMethod']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['setupPaymentMethod']>>, Error> => {
  const apiClient = useOystehrAPIClient();

  const queryResult = useQuery({
    queryKey: ['payment-methods-setup', beneficiaryPatientId],

    queryFn: () => {
      if (apiClient && beneficiaryPatientId && appointmentId) {
        return apiClient.setupPaymentMethod({
          beneficiaryPatientId,
          appointmentId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },

    enabled: Boolean(apiClient && beneficiaryPatientId && appointmentId),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useDeletePaymentMethod = (
  beneficiaryPatientId: string | undefined,
  appointmentId: string | undefined
): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['deletePaymentMethod']>>,
  Error,
  { paymentMethodId: string }
> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: ({ paymentMethodId }: { paymentMethodId: string }) => {
      if (apiClient && beneficiaryPatientId && appointmentId) {
        return apiClient.deletePaymentMethod({
          beneficiaryPatientId,
          paymentMethodId,
          appointmentId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
  });
};
