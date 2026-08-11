import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../shared/types/common';

export interface GetPaymentLocationsInput {
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): GetPaymentLocationsInput {
  return {
    secrets: input.secrets,
  };
}
