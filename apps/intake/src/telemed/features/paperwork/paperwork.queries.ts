import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, QuestionnaireResponseItem } from 'fhir/r4b';
import { OystehrAPIClient } from 'ui-components';
import { useSuccessQuery } from 'utils';
import { GetAnswerOptionsRequest, isNullOrUndefined, PromiseReturnType } from 'utils';
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

export const useAnswerOptionsQuery = (
  enabled = true,
  params: GetAnswerOptionsRequest | undefined,
  onSuccess?: (data: QuestionnaireItemAnswerOption[] | null) => void
): UseQueryResult<QuestionnaireItemAnswerOption[], Error> => {
  const apiClient = useOystehrAPIClient();

  const queryResult = useQuery({
    queryKey: ['insurances', { apiClient }],

    queryFn: async () => {
      if (!apiClient) {
        throw new Error('App client is not provided');
      }

      const resources = await apiClient.getAnswerOptions(params as GetAnswerOptionsRequest);
      return resources;
    },

    enabled: !!apiClient && enabled && params !== undefined,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

interface GetPaymentMethodsParams {
  setupCompleted: boolean;
  beneficiaryPatientId: string | undefined;
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>> | null) => void;
}

export const useGetPaymentMethods = (
  input: GetPaymentMethodsParams
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['getPaymentMethods']>>, Error> => {
  const apiClient = useOystehrAPIClient();
  const { beneficiaryPatientId, setupCompleted, onSuccess } = input;

  const queryResult = useQuery({
    queryKey: ['payment-methods', beneficiaryPatientId],

    queryFn: () => {
      if (apiClient && beneficiaryPatientId) {
        return apiClient.getPaymentMethods({
          beneficiaryPatientId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },

    enabled: Boolean(beneficiaryPatientId) && setupCompleted && Boolean(apiClient),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useSetupPaymentMethod = (
  beneficiaryPatientId: string | undefined,
  onSuccess?: (data: PromiseReturnType<ReturnType<OystehrAPIClient['setupPaymentMethod']>> | null) => void
): UseQueryResult<PromiseReturnType<ReturnType<OystehrAPIClient['setupPaymentMethod']>>, Error> => {
  const apiClient = useOystehrAPIClient();

  const queryResult = useQuery({
    queryKey: ['setup-payment-method', beneficiaryPatientId],

    queryFn: () => {
      if (apiClient && beneficiaryPatientId) {
        return apiClient.setupPaymentMethod({
          beneficiaryPatientId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },

    enabled: Boolean(apiClient && beneficiaryPatientId),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useDeletePaymentMethod = (
  beneficiaryPatientId: string | undefined
): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['deletePaymentMethod']>>,
  Error,
  { paymentMethodId: string }
> => {
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
export const useSetDefaultPaymentMethod = (
  beneficiaryPatientId: string | undefined
): UseMutationResult<
  PromiseReturnType<ReturnType<OystehrAPIClient['setDefaultPaymentMethod']>>,
  Error,
  SetDefaultPaymentMethodParams
> => {
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
