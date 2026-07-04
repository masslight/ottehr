import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface UpdateProcedureCodeParams {
  feeScheduleId: string;
  index: number;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

const UpdateProcedureCodeBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  index: z.number().int().min(0),
  code: z.string().min(1),
  description: z.string().min(1).optional(),
  modifier: z.string().min(1).optional(),
  amount: z.number(),
});

export function validateRequestParameters(input: ZambdaInput): UpdateProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, index, code, description, modifier, amount } = safeValidate(
    UpdateProcedureCodeBodySchema,
    safeJsonParse(input.body)
  );

  return {
    feeScheduleId,
    index,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
