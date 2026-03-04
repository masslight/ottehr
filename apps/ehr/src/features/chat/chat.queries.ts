import { MessagingGetMessagingConfigResponse, TransactionalSMSSendResponse } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useErrorQuery, useSuccessQuery } from 'utils';
import { ConversationMessage, SMSRecipient } from 'utils';
import { getConversation } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { MessageModel } from './ChatModal';

export const useFetchChatMessagesQuery = (
  timezone: string,
  numbersToSendTo?: string[],
  onSuccess?: (data: ConversationMessage[] | null) => void
): UseQueryResult<ConversationMessage[] | null, Error> => {
  const { oystehrZambda } = useApiClients();

  const queryResult = useQuery({
    queryKey: ['chat-messages', numbersToSendTo, timezone],

    queryFn: async () => {
      const data = await getConversation(oystehrZambda!, { smsNumbers: numbersToSendTo!, timezone });
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
