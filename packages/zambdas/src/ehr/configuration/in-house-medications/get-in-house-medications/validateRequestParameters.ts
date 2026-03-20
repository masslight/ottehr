import { ZambdaInput } from '../../../../shared';

export function validateRequestParameters(input: ZambdaInput): { secrets: ZambdaInput['secrets'] } {
  console.group('validateRequestParameters');

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    secrets: input.secrets,
  };
}
