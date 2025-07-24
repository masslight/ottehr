import { QuestionnaireItemAnswerOption, QuestionnaireResponseItem } from 'fhir/r4b';
import { useMutation, useQuery } from 'react-query';
import { OystehrAPIClient } from 'ui-components';
import { GetAnswerOptionsRequest, isNullOrUndefined, PromiseReturnType } from 'utils';
import { useOystehrAPIClient } from '../../utils';
import { useAppointmentStore } from '../appointments';

export const useGetPaperwork = (
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaperwork']>>) => void,
  params?: {
    enabled?: boolean;
    staleTime?: number;
    onError?: (error: any) => void;
  }
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiClient = useOystehrAPIClient();
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  return useQuery(
    ['paperwork', appointmentID],
    () => {
      if (apiClient && appointmentID) {
        return apiClient.getPaperwork({
          appointmentID: appointmentID,
        });
      }

      throw new Error('api client not defined or appointmentID is not provided');
    },
    {
      enabled:
        (params?.enabled && Boolean(apiClient && appointmentID)) ||
        (isNullOrUndefined(params?.enabled) && Boolean(apiClient && appointmentID)),
      staleTime: params?.staleTime,
      onSuccess,
      onError:
        params?.onError ||
        ((err) => {
          console.error('Error during fetching get paperwork: ', err);
        }),
    }
  );
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

export const useAnswerOptionsQuery = (
  enabled = true,
  params: GetAnswerOptionsRequest | undefined,
  onSuccess?: (data: QuestionnaireItemAnswerOption[]) => void
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiClient = useOystehrAPIClient();

  return useQuery(
    ['insurances', { apiClient }],
    async () => {
      if (!apiClient) {
        throw new Error('App client is not provided');
      }

      const resources = await apiClient.getAnswerOptions(params as GetAnswerOptionsRequest);
      return resources;
    },
    {
      enabled: !!apiClient && enabled && params !== undefined,
      onSuccess,
    }
  );
};

interface GetPaymentMethodsParams {
  setupCompleted: boolean;
  beneficiaryPatientId: string | undefined;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>) => void;
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPaymentMethods = (input: GetPaymentMethodsParams) => {
  const apiClient = useOystehrAPIClient();
  const { beneficiaryPatientId, setupCompleted, onSuccess } = input;

  return useQuery(
    ['payment-methods', beneficiaryPatientId],
    () => {
      if (apiClient && beneficiaryPatientId) {
        return apiClient.getPaymentMethods({
          beneficiaryPatientId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    {
      enabled: Boolean(beneficiaryPatientId) && setupCompleted && Boolean(apiClient),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get payment methods: ', err);
      },
    }
  );
};

export const useSetupPaymentMethod = (
  beneficiaryPatientId: string | undefined,
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['setupPaymentMethod']>>) => void
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const apiClient = useOystehrAPIClient();

  return useQuery(
    ['setup-payment-method', beneficiaryPatientId],
    () => {
      if (apiClient && beneficiaryPatientId) {
        return apiClient.setupPaymentMethod({
          beneficiaryPatientId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    {
      enabled: Boolean(apiClient && beneficiaryPatientId),
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching setup payment method: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useDeletePaymentMethod = (beneficiaryPatientId: string | undefined) => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: ({ paymentMethodId }: { paymentMethodId: string }) => {
      if (apiClient && beneficiaryPatientId) {
        return apiClient.deletePaymentMethod({
          beneficiaryPatientId,
          paymentMethodId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
  });
};

export interface SetDefaultPaymentMethodParams {
  paymentMethodId: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSetDefaultPaymentMethod = (beneficiaryPatientId: string | undefined) => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: ({ paymentMethodId, onSuccess, onError }: SetDefaultPaymentMethodParams) => {
      if (apiClient && beneficiaryPatientId) {
        return apiClient
          .setDefaultPaymentMethod({
            beneficiaryPatientId,
            paymentMethodId,
          })
          .then(() => {
            if (onSuccess) {
              onSuccess();
            }
          })
          .catch((error) => {
            if (onError) {
              onError(error);
            }
          });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    retry: 2,
    retryDelay: 1000,
  });
};
