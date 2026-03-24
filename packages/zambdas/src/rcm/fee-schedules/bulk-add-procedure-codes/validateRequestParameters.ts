import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

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

  const { feeScheduleId, codes, replaceAll } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (!Array.isArray(codes) || codes.length === 0) {
    throw INVALID_INPUT_ERROR('"codes" must be a non-empty array');
  }

  const validated: BulkProcedureCode[] = codes.map((entry: Record<string, unknown>, i: number) => {
    if (!entry.code || typeof entry.code !== 'string') {
      throw INVALID_INPUT_ERROR(`Row ${i + 1}: "code" is required and must be a string`);
    }
    if (entry.amount == null || typeof entry.amount !== 'number' || isNaN(entry.amount)) {
      throw INVALID_INPUT_ERROR(`Row ${i + 1}: "amount" must be a valid number`);
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
    replaceAll: replaceAll === true,
    secrets: input.secrets,
  };
}
