import { AdminAddInHouseLabInput, AdminInHouseLabItemDefinitionSchema, Secrets } from 'utils';
import { z } from 'zod';
import { ZambdaInput } from '../../../../shared';

const validationSchema = z.object({
  userId: z.string(),
  data: AdminInHouseLabItemDefinitionSchema,
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminAddInHouseLabInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminAddInHouseLabInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw new Error('Unable to parse request body. Invalid JSON.');
  }

  const validatedParsed = validationSchema.safeParse(params);
  if (!validatedParsed.success) {
    console.error(
      'Hit validation error during zod parsing. Tried to parse this json:',
      JSON.stringify(validatedParsed.error.errors),
      JSON.stringify(params)
    );
    throw new Error(`Validation failed: ${JSON.stringify(validatedParsed.error.errors)}`);
  }

  if (!params.userId) {
    throw new Error('No user id provided');
  }

  return {
    userId: params.userId,
    data: params.data,
    secrets,
    userToken,
  };
}
