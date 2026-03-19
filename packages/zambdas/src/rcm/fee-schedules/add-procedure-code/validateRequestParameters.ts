import { ZambdaInput } from '../../../shared';

export interface AddProcedureCodeParams {
  feeScheduleId: string;
  code: string;
  description: string | undefined;
  modifier: string | undefined;
  amount: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): AddProcedureCodeParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, code, description, modifier, amount } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (!code) {
    throw new Error('This field is required: "code"');
  }

  if (amount == null || typeof amount !== 'number') {
    throw new Error('"amount" must be a number');
  }

  return {
    feeScheduleId,
    code,
    description: description || undefined,
    modifier: modifier || undefined,
    amount,
    secrets: input.secrets,
  };
}
