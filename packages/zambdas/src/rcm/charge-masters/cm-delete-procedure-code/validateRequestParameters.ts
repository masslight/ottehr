import { ZambdaInput } from '../../../shared';

export interface CmDeleteProcedureCodeParams {
  chargeMasterId: string;
  index: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmDeleteProcedureCodeParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { chargeMasterId, index } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw new Error('This field is required: "chargeMasterId"');
  }

  if (index == null || typeof index !== 'number' || index < 0) {
    throw new Error('"index" must be a non-negative number');
  }

  return {
    chargeMasterId,
    index,
    secrets: input.secrets,
  };
}
