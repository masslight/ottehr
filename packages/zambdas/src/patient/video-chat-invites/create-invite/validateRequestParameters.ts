import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { VideoChatCreateInviteInput } from 'utils/lib/types/data/telemed/video-chat-invites.types';
import { emailRegex } from 'utils/lib/validation/regex';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const CreateInviteBodySchema = z
  .object({
    appointmentId: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phoneNumber: z.string().optional(),
    emailAddress: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.phoneNumber && !data.emailAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailAddress or phoneNumber is not defined. At least one must be provided.',
      });
      return;
    }
    // TODO: Temporary disable phone validation. Currently front-end sends in (xxx) xxxx-xxx format. Fix front-end.
    if (data.emailAddress && !emailRegex.test(data.emailAddress)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emailAddress is not valid',
        path: ['emailAddress'],
      });
    }
  });

export function validateRequestParameters(input: ZambdaInput): VideoChatCreateInviteInput {
  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { appointmentId, firstName, lastName, phoneNumber, emailAddress } = safeValidate(
    CreateInviteBodySchema,
    safeJsonParse(input.body)
  );

  return {
    appointmentId,
    firstName,
    lastName,
    phoneNumber: phoneNumber as string,
    emailAddress: emailAddress as string,
    secrets: input.secrets,
  };
}
