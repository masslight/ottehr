import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

const BulkProcedureCodeSchema = z.object({
  code: z.string().min(1),
  modifier: z.string().optional(),
  amount: z.number(),
});

const BulkAddProcedureCodesBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  codes: z.array(BulkProcedureCodeSchema).min(1),
  replaceAll: z.boolean().optional(),
});

export interface BulkProcedureCode {
  code: string;
  modifier: string | undefined;
  amount: number;
}

export interface BulkAddProcedureCodesParams {
  feeScheduleId: string;
  codes: BulkProcedureCode[];
  replaceAll: boolean;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): BulkAddProcedureCodesParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, codes, replaceAll } = safeValidate(BulkAddProcedureCodesBodySchema, JSON.parse(input.body));

  return {
    feeScheduleId,
    codes: codes.map((entry) => ({
      code: entry.code,
      modifier: entry.modifier || undefined,
      amount: entry.amount,
    })),
    replaceAll: replaceAll === true,
    secrets: input.secrets,
  };
}
