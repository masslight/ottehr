import { ZambdaInput } from '../types';
import { GetEmployeesInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetEmployeesInput {
  return {
    secrets: input.secrets,
  };
}
