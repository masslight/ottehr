import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { GetPatientsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  return {
    secrets: input.secrets,
  };
}
