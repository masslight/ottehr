import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface CreateChargeMasterParams {
  name: string;
  effectiveDate: string;
  description: string;
  secrets: ZambdaInput['secrets'];
}

const CreateChargeMasterBodySchema = z.object({
  name: z.string().min(1),
  effectiveDate: z.string().date(),
  description: z.string().default(''),
});

export function validateRequestParameters(input: ZambdaInput): CreateChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { name, effectiveDate, description } = safeValidate(CreateChargeMasterBodySchema, safeJsonParse(input.body));

  return {
    name,
    effectiveDate,
    description: description ?? '',
    secrets: input.secrets,
  };
}
