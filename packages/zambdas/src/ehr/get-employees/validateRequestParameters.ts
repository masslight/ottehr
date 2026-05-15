import { ZambdaInput } from '../../shared';
import { GetEmployeesInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetEmployeesInput {
  let lite = false;
  if (input.body) {
    try {
      const parsed = JSON.parse(input.body);
      lite = parsed?.lite === true;
    } catch {
      // Body is optional for this endpoint; ignore parse errors and fall back to full payload.
    }
  }
  return {
    secrets: input.secrets,
    lite,
  };
}
