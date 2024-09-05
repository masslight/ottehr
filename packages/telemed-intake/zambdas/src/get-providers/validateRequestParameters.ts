import { ZambdaInput } from 'ottehr-utils';
import { GetProvidersInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetProvidersInput {
  return {
    secrets: input.secrets,
  };
}
