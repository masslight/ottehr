import { MISSING_REQUEST_SECRETS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    secrets: input.secrets,
  };
}
