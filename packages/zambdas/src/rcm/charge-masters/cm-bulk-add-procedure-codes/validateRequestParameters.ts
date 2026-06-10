import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface CmBulkProcedureCode {
  code: string;
  modifier: string | undefined;
  amount: number;
}

export interface CmBulkAddProcedureCodesParams {
  chargeMasterId: string;
  codes: CmBulkProcedureCode[];
  replaceAll: boolean;
  secrets: ZambdaInput['secrets'];
}

const CmBulkProcedureCodeSchema = z.object({
  code: z.string().min(1),
  modifier: z.string().min(1).optional(),
  amount: z.number(),
});

const CmBulkAddProcedureCodesBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  codes: z.array(CmBulkProcedureCodeSchema).min(1),
  replaceAll: z.boolean().optional(),
});

export function validateRequestParameters(input: ZambdaInput): CmBulkAddProcedureCodesParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, codes, replaceAll } = safeValidate(CmBulkAddProcedureCodesBodySchema, JSON.parse(input.body));

  return {
    chargeMasterId,
    codes: codes.map((entry) => ({
      code: entry.code,
      modifier: entry.modifier || undefined,
      amount: entry.amount,
    })),
    replaceAll: replaceAll === true,
    secrets: input.secrets,
  };
}
