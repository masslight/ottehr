import { ZambdaInput } from '../../../shared';

export interface ListChargeMastersParams {
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): ListChargeMastersParams {
  return {
    secrets: input.secrets,
  };
}
