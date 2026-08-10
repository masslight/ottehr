import { ZambdaInput } from '../../../shared/types/common';

export interface ListChargeMastersParams {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): ListChargeMastersParams {
  return {
    secrets: input.secrets,
  };
}
