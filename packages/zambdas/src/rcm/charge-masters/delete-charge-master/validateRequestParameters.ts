import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface DeleteChargeMasterParams {
  id: string;
  secrets: ZambdaInput['secrets'];
}

const bodySchema = z.object({
  id: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): DeleteChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { id } = safeValidate(bodySchema, parsed);

  return {
    id,
    secrets: input.secrets,
  };
}
