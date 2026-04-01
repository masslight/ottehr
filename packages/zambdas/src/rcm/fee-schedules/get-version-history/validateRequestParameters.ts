import { MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetVersionHistoryParams {
  secrets: ZambdaInput['secrets'];
  resourceId: string;
}

export function validateRequestParameters(input: ZambdaInput): GetVersionHistoryParams {
  const { resourceId } = input.body ? JSON.parse(input.body) : input;

  if (!resourceId) {
    throw MISSING_REQUIRED_PARAMETERS(['resourceId']);
  }

  return {
    secrets: input.secrets,
    resourceId,
  };
}
