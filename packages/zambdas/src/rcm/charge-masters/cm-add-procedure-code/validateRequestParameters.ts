import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

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
  code: z.string().min(1),
  description: z.string().min(1).optional(),
  modifier: z.string().min(1).optional(),
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
