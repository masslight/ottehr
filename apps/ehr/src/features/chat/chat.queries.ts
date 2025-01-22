import { TransactionalSMSSendResponse } from '@oystehr/sdk';
import { useMutation, useQuery } from 'react-query';
import { ConversationMessage, SMSRecipient } from 'utils';
import { getConversation } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { MessageModel } from './ChatModal';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useFetchChatMessagesQuery = (
  timezone: string,
  numbersToSendTo?: string[],
  onSuccess?: (data: ConversationMessage[]) => void
) => {
  const { oystehr } = useApiClients();
  return useQuery(
    ['chat-messages', numbersToSendTo, timezone],
    async () => {
      return await getConversation(oystehr!, { smsNumbers: numbersToSendTo!, timezone });
    },
    {
      onSuccess,
      enabled: Boolean(oystehr && numbersToSendTo?.length && timezone),
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
  const { oystehr } = useApiClients();
  return useMutation(
    ['chat-messages'],
    async (pendingMessage: MessageModel): Promise<MessageModel> => {
      if (oystehr === undefined) {
        throw new Error(`Message send failed. OystehrUndefined`);
      }
      const messageSends = recipients.map(
        (recip): Promise<TransactionalSMSSendResponse> =>
          oystehr?.transactionalSMS.send({
            message,
            resource: recip.recipientResourceUri,
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
