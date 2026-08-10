import { ZambdaInput } from '../../shared/types/common';
import { GetPatientsInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetPatientsInput {
  return {
    secrets: input.secrets,
  };
}
