import { SendSMSOutput } from '@zapehr/sdk';
import { useMutation, useQuery } from 'react-query';
import { ConversationMessage, SMSRecipient } from 'ehr-utils';
import { getConversation } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { useMessagingClient } from '../../hooks/useMessagingClient';
import { MessageModel } from './ChatModal';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useFetchChatMessagesQuery = (
  timezone: string,
  numbersToSendTo?: string[],
  onSuccess?: (data: ConversationMessage[]) => void
) => {
  const { zambdaClient } = useApiClients();
  return useQuery(
    ['chat-messages', numbersToSendTo, timezone],
    async () => {
      return await getConversation(zambdaClient!, { smsNumbers: numbersToSendTo!, timezone });
    },
    {
      onSuccess,
      enabled: Boolean(zambdaClient && numbersToSendTo?.length && timezone),
    }
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useSendMessagesMutation = (
  recipients: SMSRecipient[],
  message: string,
  onSuccess: (data: MessageModel) => void,
  onError: (error: any) => void
) => {
  const messagingClient = useMessagingClient();
  return useMutation(
    ['chat-messages'],
    async (pendingMessage: MessageModel): Promise<MessageModel> => {
      if (messagingClient === undefined) {
        throw new Error(`Message send failed. MessagingClientUndefined`);
      }
      const messageSends = recipients.map(
        (recip): Promise<SendSMSOutput> =>
          messagingClient?.sendSMS({
            message,
            resource: `RelatedPerson/${recip.relatedPersonId}`,
            phoneNumber: recip.smsNumber,
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
        const result = (firstSuccess as PromiseFulfilledResult<SendSMSOutput>).value;
        return { ...pendingMessage, resolvedId: result.resourceId, id: result.resourceId };
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
