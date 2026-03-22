import { ZambdaInput } from '../../../shared';

export interface GetVersionHistoryParams {
  secrets: ZambdaInput['secrets'];
  resourceId: string;
}

export function validateRequestParameters(input: ZambdaInput): GetVersionHistoryParams {
  const { resourceId } = input.body ? JSON.parse(input.body) : input;

  if (!resourceId) {
    throw new Error('resourceId is required');
  }

  return {
    secrets: input.secrets,
    resourceId,
  };
}
