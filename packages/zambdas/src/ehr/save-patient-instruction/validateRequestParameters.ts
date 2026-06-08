import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY, SavePatientInstructionInput } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const SavePatientInstructionBodySchema = z
  .object({
    instructionId: z.string().uuid().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
  })
  .refine((data) => {
    const hasText = typeof data.text === 'string' && data.text.trim().length > 0;
    const hasTitle = typeof data.title === 'string' && data.title.trim().length > 0;
    return hasText || hasTitle;
  }, 'Either text or title must be provided');

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientInstructionInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const parsed = JSON.parse(input.body) as unknown;
  const data = safeValidate(SavePatientInstructionBodySchema, parsed);

  return { ...data, secrets: input.secrets, userToken };
}
