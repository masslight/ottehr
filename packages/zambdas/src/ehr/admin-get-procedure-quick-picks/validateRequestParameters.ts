import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets } {
  if (!input.secrets) {
    throw new Error('No secrets provided in input');
  }

  return {
    secrets: input.secrets,
  };
}
