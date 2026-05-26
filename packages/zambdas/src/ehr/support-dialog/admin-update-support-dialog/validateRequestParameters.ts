import {
  AdminUpdateSupportDialogInput,
  INVALID_INPUT_ERROR,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared';

const validationSchema = z.object({
  bodyHtml: z.string(),
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminUpdateSupportDialogInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminUpdateSupportDialogInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const result = validationSchema.safeParse(params);
  if (!result.success) {
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(result.error.errors)}`);
  }

  return { bodyHtml: result.data.bodyHtml, secrets, userToken };
}
