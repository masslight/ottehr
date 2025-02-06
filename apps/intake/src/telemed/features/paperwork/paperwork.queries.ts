import { useMutation, useQuery } from 'react-query';
import { ZapEHRAPIClient } from 'ui-components';
import { GetAnswerOptionsRequest, PromiseReturnType, getSelectors, isNullOrUndefined } from 'utils';
import { useZapEHRAPIClient } from '../../utils';
import { useAppointmentStore } from '../appointments';
import { usePatientInfoStore } from '../patient-info';
import { QuestionnaireItemAnswerOption, QuestionnaireResponseItem } from 'fhir/r4b';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPaperwork = (
  onSuccess?: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getPaperwork']>>) => void,
  params?: {
    enabled?: boolean;
    staleTime?: number;
    onError?: (error: any) => void;
  }
) => {
  const apiClient = useZapEHRAPIClient();
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
      apiClient: ZapEHRAPIClient;
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useAnswerOptionsQuery = (
  enabled = true,
  params: GetAnswerOptionsRequest | undefined,
  onSuccess?: (data: QuestionnaireItemAnswerOption[]) => void
) => {
  const apiClient = useZapEHRAPIClient();

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetPaymentMethods = (
  onSuccess?: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['getPaymentMethods']>>) => void
) => {
  const apiClient = useZapEHRAPIClient();
  const beneficiaryPatientId = usePatientInfoStore((state) => state.patientInfo.id);

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
      enabled: false,
      onSuccess,
      onError: (err) => {
        console.error('Error during fetching get payment methods: ', err);
      },
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSetupPaymentMethod = (
  onSuccess?: (data: PromiseReturnType<ReturnType<ZapEHRAPIClient['setupPaymentMethod']>>) => void
) => {
  const apiClient = useZapEHRAPIClient();
  const beneficiaryPatientId = usePatientInfoStore((state) => state.patientInfo.id);

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
export const useDeletePaymentMethod = () => {
  const apiClient = useZapEHRAPIClient();
  const {
    patientInfo: { id },
  } = getSelectors(usePatientInfoStore, ['patientInfo']);

  return useMutation({
    mutationFn: ({ paymentMethodId }: { paymentMethodId: string }) => {
      if (apiClient && id) {
        return apiClient.deletePaymentMethod({
          beneficiaryPatientId: id,
          paymentMethodId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSetDefaultPaymentMethod = () => {
  const apiClient = useZapEHRAPIClient();
  const {
    patientInfo: { id },
  } = getSelectors(usePatientInfoStore, ['patientInfo']);

  return useMutation({
    mutationFn: ({ paymentMethodId }: { paymentMethodId: string }) => {
      if (apiClient && id) {
        return apiClient.setDefaultPaymentMethod({
          beneficiaryPatientId: id,
          paymentMethodId,
        });
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    retry: 5,
    retryDelay: 1000,
  });
};
