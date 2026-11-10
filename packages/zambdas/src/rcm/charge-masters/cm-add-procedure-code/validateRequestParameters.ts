import { sanitizeStringForFhirCode } from 'utils/lib/fhir/helpers';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { optionalTextSchema } from 'utils/lib/types/text-schemas';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface CmAddProcedureCodeParams {
  chargeMasterId: string;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

const CmAddProcedureCodeBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  code: z.string().transform(sanitizeStringForFhirCode).pipe(z.string().min(1)),
  description: optionalTextSchema,
  modifier: z.string().transform(sanitizeStringForFhirCode).optional(),
  amount: z.number(),
});

export function validateRequestParameters(input: ZambdaInput): CmAddProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, code, description, modifier, amount } = safeValidate(
    CmAddProcedureCodeBodySchema,
    safeJsonParse(input.body)
  );

  return {
    chargeMasterId,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
