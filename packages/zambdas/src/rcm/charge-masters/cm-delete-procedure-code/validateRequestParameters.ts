import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface CmDeleteProcedureCodeParams {
  chargeMasterId: string;
  index: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmDeleteProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, index } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (index == null || typeof index !== 'number' || index < 0) {
    throw INVALID_INPUT_ERROR('"index" must be a non-negative number');
  }

  return {
    chargeMasterId,
    index,
    secrets: input.secrets,
  };
}
