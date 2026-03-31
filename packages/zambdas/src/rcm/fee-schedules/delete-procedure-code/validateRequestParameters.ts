import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DeleteProcedureCodeParams {
  feeScheduleId: string;
  index: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteProcedureCodeParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, index } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (index == null || typeof index !== 'number' || index < 0) {
    throw INVALID_INPUT_ERROR('"index" must be a non-negative number');
  }

  return {
    feeScheduleId,
    index,
    secrets: input.secrets,
  };
}
