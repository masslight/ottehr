import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetPaymentLocationsInput {
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): GetPaymentLocationsInput {
  return {
    secrets: input.secrets,
  };
}
