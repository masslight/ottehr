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
    throw new Error('No request body provided');
  }

  const { chargeMasterId, code, description, modifier, amount } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw new Error('This field is required: "chargeMasterId"');
  }

  if (!code) {
    throw new Error('This field is required: "code"');
  }

  if (amount == null || typeof amount !== 'number') {
    throw new Error('"amount" must be a number');
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
