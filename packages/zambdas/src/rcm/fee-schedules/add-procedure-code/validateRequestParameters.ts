import { sanitizeStringForFhirCode } from 'utils/lib/fhir/helpers';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { optionalTextSchema } from 'utils/lib/types/text-schemas';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const AddProcedureCodeBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  code: z.string().transform(sanitizeStringForFhirCode).pipe(z.string().min(1)),
  description: optionalTextSchema,
  modifier: z.string().transform(sanitizeStringForFhirCode).optional(),
  amount: z.number(),
});

export interface AddProcedureCodeParams {
  feeScheduleId: string;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): AddProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, code, description, modifier, amount } = safeValidate(
    AddProcedureCodeBodySchema,
    safeJsonParse(input.body)
  );

  return {
    feeScheduleId,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
