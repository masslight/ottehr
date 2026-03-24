import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface CmAddProcedureCodeParams {
  chargeMasterId: string;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmAddProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, code, description, modifier, amount } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (!code) {
    throw MISSING_REQUIRED_PARAMETERS(['code']);
  }

  if (amount == null || typeof amount !== 'number') {
    throw INVALID_INPUT_ERROR('"amount" must be a number');
  }

  return {
    chargeMasterId,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
