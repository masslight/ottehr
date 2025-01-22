import { ZambdaInput } from 'utils';
import { GetPatientsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  return {
    secrets: input.secrets,
  };
}
