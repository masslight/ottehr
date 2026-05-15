import { AdminUpdateLocationSupportPhonesInput, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared';

const validationSchema = z.object({
  updates: z
    .array(
      z.object({
        locationId: z.string().min(1),
        phoneNumber: z.string(),
      })
    )
    .min(1),
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminUpdateLocationSupportPhonesInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminUpdateLocationSupportPhonesInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const result = validationSchema.safeParse(params);
  if (!result.success) {
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(result.error.errors)}`);
  }

  return { updates: result.data.updates, secrets, userToken };
}
