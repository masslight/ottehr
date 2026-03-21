import { ZambdaInput } from '../../../shared';

export interface CmBulkProcedureCode {
  code: string;
  modifier: string | undefined;
  amount: number;
}

export interface CmBulkAddProcedureCodesParams {
  chargeMasterId: string;
  codes: CmBulkProcedureCode[];
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmBulkAddProcedureCodesParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { chargeMasterId, codes } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw new Error('This field is required: "chargeMasterId"');
  }

  if (!Array.isArray(codes) || codes.length === 0) {
    throw new Error('"codes" must be a non-empty array');
  }

  const validated: CmBulkProcedureCode[] = codes.map((entry: Record<string, unknown>, i: number) => {
    if (!entry.code || typeof entry.code !== 'string') {
      throw new Error(`Row ${i + 1}: "code" is required and must be a string`);
    }
    if (entry.amount == null || typeof entry.amount !== 'number' || isNaN(entry.amount)) {
      throw new Error(`Row ${i + 1}: "amount" must be a valid number`);
    }
    return {
      code: entry.code,
      modifier: (entry.modifier as string) || undefined,
      amount: entry.amount,
    };
  });

  return {
    chargeMasterId,
    codes: validated,
    secrets: input.secrets,
  };
}
