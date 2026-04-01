import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DeleteFeeScheduleParams {
  id: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeleteFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { id } = JSON.parse(input.body);

  if (!id) {
    throw MISSING_REQUIRED_PARAMETERS(['id']);
  }

  return {
    id,
    secrets: input.secrets,
  };
}
