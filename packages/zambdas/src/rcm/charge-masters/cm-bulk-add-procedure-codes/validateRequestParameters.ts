import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

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

export function validateRequestParameters(input: ZambdaInput): CmBulkAddProcedureCodesParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, codes, replaceAll } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (!Array.isArray(codes) || codes.length === 0) {
    throw INVALID_INPUT_ERROR('"codes" must be a non-empty array');
  }

  const validated: CmBulkProcedureCode[] = codes.map((entry: Record<string, unknown>, i: number) => {
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
    chargeMasterId,
    codes: validated,
    replaceAll: replaceAll === true,
    secrets: input.secrets,
  };
}
