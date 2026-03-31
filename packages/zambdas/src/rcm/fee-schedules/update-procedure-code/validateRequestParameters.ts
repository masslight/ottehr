import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface UpdateProcedureCodeParams {
  feeScheduleId: string;
  index: number;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, index, code, description, modifier, amount } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (index == null || typeof index !== 'number' || index < 0) {
    throw INVALID_INPUT_ERROR('"index" must be a non-negative number');
  }

  if (!code) {
    throw MISSING_REQUIRED_PARAMETERS(['code']);
  }

  if (amount == null || typeof amount !== 'number') {
    throw INVALID_INPUT_ERROR('"amount" must be a number');
  }

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
