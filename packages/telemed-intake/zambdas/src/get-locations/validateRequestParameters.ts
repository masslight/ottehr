import { ZambdaInput } from 'ottehr-utils';
import { GetLocationsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetLocationsInput {
  return {
    secrets: input.secrets,
  };
}
