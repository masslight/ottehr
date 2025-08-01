import { MessagingGetMessagingConfigResponse, TransactionalSMSSendResponse } from '@oystehr/sdk';
import { useMutation, UseMutationResult, useQuery, UseQueryResult } from 'react-query';
import { ConversationMessage, SMSRecipient } from 'utils';
import { getConversation } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { MessageModel } from './ChatModal';

export const useFetchChatMessagesQuery = (
  timezone: string,
  numbersToSendTo?: string[],
  onSuccess?: (data: ConversationMessage[]) => void
): UseQueryResult<ConversationMessage[], unknown> => {
  const { oystehrZambda } = useApiClients();
  return useQuery(
    ['chat-messages', numbersToSendTo, timezone],
    async () => {
      return await getConversation(oystehrZambda!, { smsNumbers: numbersToSendTo!, timezone });
    },
    {
      onSuccess,
      enabled: Boolean(oystehrZambda && numbersToSendTo?.length && timezone),
    }
  );
};

export const useSendMessagesMutation = (
  recipients: SMSRecipient[],
  message: string,
  onSuccess: (data: MessageModel) => void,
  onError: (error: any) => void
): UseMutationResult<MessageModel, unknown, MessageModel> => {
  const { oystehr } = useApiClients();
  return useMutation(
    ['chat-messages'],
    async (pendingMessage: MessageModel): Promise<MessageModel> => {
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
    { onSuccess, onError }
  );
};

export const useGetMessagingConfigQuery = (
  onSuccess?: (data: MessagingGetMessagingConfigResponse) => void,
  onError?: () => void
): UseQueryResult<MessagingGetMessagingConfigResponse, unknown> => {
  const { oystehr } = useApiClients();
  return useQuery(
    'messaging-config',
    async () => {
      if (!oystehr) {
        throw new Error('API client not available');
      }

      return await oystehr.messaging.getMessagingConfig();
    },
    {
      onSuccess,
      onError,
      enabled: !!oystehr,
    }
  );
};
