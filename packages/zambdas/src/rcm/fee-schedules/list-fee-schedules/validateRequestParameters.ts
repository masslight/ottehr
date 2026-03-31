import { ZambdaInput } from '../../../shared';

export interface ListFeeSchedulesParams {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): ListFeeSchedulesParams {
  return {
    secrets: input.secrets,
  };
}
