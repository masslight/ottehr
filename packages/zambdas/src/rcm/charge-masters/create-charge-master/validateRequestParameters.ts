import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { optionalTextSchema, requiredTextSchema } from 'utils/lib/types/text-schemas';
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
  name: requiredTextSchema,
  effectiveDate: z.string().date(),
  description: optionalTextSchema,
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
