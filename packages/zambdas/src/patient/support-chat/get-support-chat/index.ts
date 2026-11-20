import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import {
  GetSupportChatInputSchema,
  GetSupportChatResponse,
  SUPPORT_CHAT_BOT_NAME,
  SupportChatMessageDto,
} from 'utils/lib/types/api/support-chat.types';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { greetingMessage } from '../../../shared/support-chat/bot';
import {
  isUnreadFor,
  resolveThread,
  searchThread,
  searchUnread,
  toChatResponse,
} from '../../../shared/support-chat/thread';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

let m2mToken: string;

export const index = wrapHandler('get-support-chat', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);

  const { taskId, unreadOnly, secrets } = validateWithSchema(GetSupportChatInputSchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const user = await getUser(userToken, secrets);

  const { threadId, viewer, isAvailable } = await resolveThread(user, taskId, oystehr);

  if (unreadOnly) {
    const unread = threadId ? await searchUnread(oystehr, threadId) : [];
    const unreadCount = unread.filter((message) => isUnreadFor(message, viewer)).length;
    return { statusCode: 200, body: JSON.stringify({ isAvailable, messages: [], unreadCount }) };
  }

  const messages = threadId ? await searchThread(oystehr, threadId) : [];

  const response: GetSupportChatResponse = messages.length
    ? toChatResponse(messages, viewer)
    : { isAvailable, messages: isAvailable ? [makeGreetingDto()] : [], unreadCount: 0 };

  return { statusCode: 200, body: JSON.stringify(response) };
});

function makeGreetingDto(): SupportChatMessageDto {
  const { kind, text, options } = greetingMessage();
  return {
    id: 'greeting',
    author: 'bot',
    authorName: SUPPORT_CHAT_BOT_NAME,
    kind,
    text,
    sentAt: DateTime.now().toISO(),
    isRead: true,
    options,
  };
}
