import { ListTemplatesZambdaInput } from 'utils/lib/types/data/list-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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

  const parsed = safeJsonParse(input.body) as unknown;
  const { includeVersionData } = safeValidate(ListTemplatesSchema, parsed);

  return {
    includeVersionData,
    secrets: input.secrets,
  };
}
