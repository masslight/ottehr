import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): Pick<ZambdaInput, 'secrets'> {
  console.group('validateRequestParameters');

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    secrets: input.secrets,
  };
}
