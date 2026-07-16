import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

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
