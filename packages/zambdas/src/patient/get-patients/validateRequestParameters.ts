import {} from 'utils';
import { ZambdaInput } from '../../shared';
import { GetPatientsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  return {
    secrets: input.secrets,
  };
}
