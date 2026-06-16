import { Secrets } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets } {
  if (!input.secrets) {
    throw new Error('Input did not have any secrets');
  }
  return { secrets: input.secrets };
}
