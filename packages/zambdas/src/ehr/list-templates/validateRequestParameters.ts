import { ListTemplatesZambdaInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const ListTemplatesSchema = z.object({
  includeVersionData: z.boolean(),
});

export function validateRequestParameters(input: ZambdaInput): ListTemplatesZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const { includeVersionData } = safeValidate(ListTemplatesSchema, parsed);

  return {
    includeVersionData,
    secrets: input.secrets,
  };
}
