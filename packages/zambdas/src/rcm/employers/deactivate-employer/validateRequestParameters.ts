import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DeactivateEmployerParams {
  employerId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DeactivateEmployerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { employerId } = JSON.parse(input.body);

  if (!employerId) {
    throw MISSING_REQUIRED_PARAMETERS(['employerId']);
  }

  return {
    employerId,
    secrets: input.secrets,
  };
}
