import { CancelInviteParticipantRequestInput, emailRegex, INVALID_INPUT_ERROR, phoneRegex } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

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
