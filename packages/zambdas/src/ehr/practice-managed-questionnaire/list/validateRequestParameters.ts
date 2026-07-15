import { MISSING_REQUEST_BODY, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  return {
    secrets,
  };
}
