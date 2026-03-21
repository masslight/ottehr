import { ZambdaInput } from '../../../shared';

export interface CmUpdateProcedureCodeParams {
  chargeMasterId: string;
  index: number;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmUpdateProcedureCodeParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { chargeMasterId, index, code, description, modifier, amount } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw new Error('This field is required: "chargeMasterId"');
  }

  if (index == null || typeof index !== 'number' || index < 0) {
    throw new Error('"index" must be a non-negative number');
  }

  if (!code) {
    throw new Error('This field is required: "code"');
  }

  if (amount == null || typeof amount !== 'number') {
    throw new Error('"amount" must be a number');
  }

  return {
    chargeMasterId,
    index,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
