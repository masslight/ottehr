import { ZambdaInput } from 'zambda-utils';
import { GetEmployeesInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetEmployeesInput {
  return {
    secrets: input.secrets,
  };
}
