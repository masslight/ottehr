import { AdminGetInHouseLabConfigInput, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { ZambdaInput } from '../../../../shared';

const validationSchema = z.object({
  activityDefinitionId: z.string(),
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminGetInHouseLabConfigInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminGetInHouseLabConfigInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validatedParsed = validationSchema.safeParse(params);
  if (!validatedParsed.success) {
    console.error(
      'Hit validation error during zod parsing. Tried to parse this json:',
      JSON.stringify(validatedParsed.error.errors),
      JSON.stringify(params)
    );
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(validatedParsed.error.errors)}`);
  }

  return {
    activityDefinitionId: params.activityDefinitionId,
    secrets,
    userToken,
  };
}
