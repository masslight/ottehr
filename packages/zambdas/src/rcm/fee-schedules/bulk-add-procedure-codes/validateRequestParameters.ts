import { ZambdaInput } from '../../../shared';

export interface BulkProcedureCode {
  code: string;
  modifier: string | undefined;
  amount: number;
}

export interface BulkAddProcedureCodesParams {
  feeScheduleId: string;
  codes: BulkProcedureCode[];
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): BulkAddProcedureCodesParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, codes } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (!Array.isArray(codes) || codes.length === 0) {
    throw new Error('"codes" must be a non-empty array');
  }

  const validated: BulkProcedureCode[] = codes.map((entry: Record<string, unknown>, i: number) => {
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
    feeScheduleId,
    codes: validated,
    secrets: input.secrets,
  };
}
