import { MessagingGetMessagingConfigResponse, TransactionalSMSSendResponse } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  BRANDING_CONFIG,
  ConversationMessage,
  QuickTextQuickPickData,
  replaceTemplateVariablesArrows,
  SMSRecipient,
  useErrorQuery,
  useSuccessQuery,
} from 'utils';
import { getConversation, getQuickTextQuickPicks } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { MessageModel } from './ChatModal';

export const useFetchChatMessagesQuery = (
  timezone: string,
  patientId: string,
  numbersToSendTo?: string[],
  onSuccess?: (data: ConversationMessage[] | null) => void
): UseQueryResult<ConversationMessage[] | null, Error> => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['chat-messages', numbersToSendTo, timezone],

    queryFn: async () => {
      const data = await getConversation(oystehrZambda!, { patientId, timezone });
      return data ? data : null;
    },

    enabled: Boolean(oystehrZambda && numbersToSendTo?.length && timezone),
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};

export const useSendMessagesMutation = (
  recipients: SMSRecipient[],
  message: string,
  onSuccess: (data: MessageModel) => void,
  onError: (error: Error) => void
): UseMutationResult<MessageModel, Error, MessageModel> => {
  const { oystehr } = useApiClients();

  return useMutation({
    mutationKey: ['chat-messages'],

    mutationFn: async (pendingMessage: MessageModel): Promise<MessageModel> => {
      if (oystehr === undefined) {
        throw new Error(`Message send failed. OystehrUndefined`);
      }
      const messageSends = recipients.map(
        (recipient): Promise<TransactionalSMSSendResponse> =>
          oystehr?.transactionalSMS.send({
            message,
            resource: recipient.recipientResourceUri,
          })
      );
      const outputs = await Promise.allSettled(messageSends);
      const firstSuccess = outputs.find((result) => {
        if (result.status === 'fulfilled') {
          return true;
        }
        return false;
      });
      if (firstSuccess) {
        const result = (firstSuccess as PromiseFulfilledResult<TransactionalSMSSendResponse>).value;
        return { ...pendingMessage, resolvedId: result.resourceId, id: result.resourceId! };
      } else {
        const firstFailure = outputs.find((result) => {
          if (result.status === 'rejected') {
            return true;
          }
          return false;
        }) as PromiseRejectedResult | undefined;

        if (firstFailure) {
          throw new Error(`Message send failed: ${firstFailure.reason}`);
        } else {
          throw new Error(`Message send failed.`);
        }
      }
    },

    onSuccess,
    onError,
  });
};

export interface QuickTextsContext {
  patientAppUrl?: string;
  patientName?: string;
  visitId?: string;
  locationName?: string;
  start?: string;
  officePhone?: string;
  supportPhone?: string;
}

export interface ResolvedQuickText {
  name: string;
  english: string;
  spanish?: string;
}

export const buildQuickTextVariables = (ctx: QuickTextsContext): Record<string, string> => ({
  patientName: ctx.patientName ?? '',
  visitUrl: ctx.patientAppUrl && ctx.visitId ? `${ctx.patientAppUrl}/visit/${ctx.visitId}` : '',
  aiInterviewUrl:
    ctx.patientAppUrl && ctx.visitId ? `${ctx.patientAppUrl}/visit/${ctx.visitId}/ai-interview-start` : '',
  projectName: BRANDING_CONFIG.projectName,
  locationName: ctx.locationName ?? '',
  start: ctx.start ?? '',
  officePhone: ctx.officePhone ?? '',
  supportPhone: ctx.supportPhone ?? '',
});

export const resolveQuickText = (
  quickPick: QuickTextQuickPickData,
  vars: Record<string, string>
): ResolvedQuickText => ({
  name: quickPick.name,
  english: replaceTemplateVariablesArrows(quickPick.english, vars),
  spanish: quickPick.spanish ? replaceTemplateVariablesArrows(quickPick.spanish, vars) : undefined,
});

export const useQuickTextsQuery = (): UseQueryResult<QuickTextQuickPickData[], Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['quick-text-quick-picks'],
    queryFn: async () => {
      const response = await getQuickTextQuickPicks(oystehrZambda!);
      return [...response.quickPicks].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    },
    enabled: !!oystehrZambda,
  });
};

export const useGetMessagingConfigQuery = (
  onSuccess?: (data: MessagingGetMessagingConfigResponse | null) => void,
  onError?: () => void
): UseQueryResult<MessagingGetMessagingConfigResponse, Error> => {
  const { oystehr } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['messaging-config'],

    queryFn: async () => {
      if (!oystehr) {
        throw new Error('API client not available');
      }
      return await oystehr.messaging.getMessagingConfig();
    },

    enabled: !!oystehr,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  useErrorQuery(queryResult.error, onError);

  return queryResult;
};
