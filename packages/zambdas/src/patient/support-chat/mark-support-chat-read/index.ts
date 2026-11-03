import { APIGatewayProxyResult } from 'aws-lambda';
import { MarkSupportChatReadInputSchema } from 'utils/lib/types/api/support-chat.types';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { clearTasksUnread } from '../../../shared/support-chat/request-task';
import { markThreadRead, resolveThread, searchThread } from '../../../shared/support-chat/thread';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

let m2mToken: string;

export const index = wrapHandler(
  'mark-support-chat-read',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const userToken = getUserToken(input);
    const { taskId, secrets } = validateWithSchema(MarkSupportChatReadInputSchema, input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const user = await getUser(userToken, secrets);
    const { threadId, viewer } = await resolveThread(user, taskId, oystehr);

    if (threadId) {
      await markThreadRead(oystehr, await searchThread(oystehr, threadId), viewer);

      if (viewer === 'staff') await clearTasksUnread(oystehr, threadId);
    }

    return { statusCode: 200, body: JSON.stringify({}) };
  }
);
