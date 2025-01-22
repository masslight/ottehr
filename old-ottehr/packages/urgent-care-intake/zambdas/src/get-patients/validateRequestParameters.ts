import { ZambdaInput } from 'ottehr-utils';
import { GetPatientsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  return {
    secrets: input.secrets,
  };
}
