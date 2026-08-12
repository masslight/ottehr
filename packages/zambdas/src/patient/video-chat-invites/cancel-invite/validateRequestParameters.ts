import { CancelInviteParticipantRequestInput } from 'utils/lib/types/data/telemed/video-chat-invites.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { emailRegex, phoneRegex } from 'utils/lib/validation/regex';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const CancelInviteBodySchema = z
  .object({
    appointmentId: z.string().min(1),
    emailAddress: z.string().optional(),
    phoneNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.emailAddress && !data.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailAddress or phoneNumber is not defined',
      });
      return;
    }
    if (data.emailAddress && !emailRegex.test(data.emailAddress)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailAddress is not valid',
        path: ['emailAddress'],
      });
    }
    if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'phoneNumber is not valid',
        path: ['phoneNumber'],
      });
    }
  });

export function validateRequestParameters(input: ZambdaInput): CancelInviteParticipantRequestInput {
  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { appointmentId, emailAddress, phoneNumber } = safeValidate(CancelInviteBodySchema, safeJsonParse(input.body));

  return {
    appointmentId,
    emailAddress: emailAddress as string,
    phoneNumber: phoneNumber as string,
    secrets: input.secrets,
  };
}
