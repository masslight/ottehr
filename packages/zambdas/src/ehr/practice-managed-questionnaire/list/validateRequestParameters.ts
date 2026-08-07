import { Secrets } from 'utils/lib/secrets';
import { ZambdaInput } from '../../../shared/types/common';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  const secrets = input.secrets;

  return {
    secrets,
  };
}
