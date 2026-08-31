import { ZambdaInput } from '../../../shared/types/common';

export interface ListEmployersParams {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): ListEmployersParams {
  return {
    secrets: input.secrets,
  };
}
