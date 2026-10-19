import { Secrets } from 'utils/lib/secrets';
import { TWILIO_CONVERSATION_SID_PATTERN } from 'utils/lib/types/api/employee-chat.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { getUserToken } from '../../shared/auth';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const OpenEmployeeChatSchema = z.object({
  targetProfile: z
    .string()
    .regex(/^Practitioner\/[A-Za-z0-9\-.]{1,64}$/, 'targetProfile must be a Practitioner reference'),
  replaceClosedConversationSid: z
    .string()
    .regex(TWILIO_CONVERSATION_SID_PATTERN, 'replaceClosedConversationSid must be a Twilio Conversation SID')
    .optional(),
});

export interface OpenEmployeeChatInputValidated {
  targetProfile: string;
  replaceClosedConversationSid?: string;
  secrets: Secrets;
  userToken: string;
}

export function validateRequestParameters(input: ZambdaInput): OpenEmployeeChatInputValidated {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const { targetProfile, replaceClosedConversationSid } = safeValidate(
    OpenEmployeeChatSchema,
    safeJsonParse(input.body)
  );
  return { targetProfile, replaceClosedConversationSid, secrets: input.secrets, userToken: getUserToken(input) };
}
