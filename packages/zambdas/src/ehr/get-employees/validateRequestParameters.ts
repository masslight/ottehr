import { z } from 'zod';
import { ZambdaInput } from '../../shared';
import { GetEmployeesInput } from '.';

const GetEmployeesBodySchema = z.object({
  lite: z.literal(true).optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetEmployeesInput {
  let lite = false;
  if (input.body) {
    try {
      const parsed = JSON.parse(input.body);
      const result = GetEmployeesBodySchema.safeParse(parsed);
      lite = result.success ? result.data.lite === true : false;
    } catch {
      // Body is optional for this endpoint; ignore parse errors and fall back to full payload.
    }
  }
  return {
    secrets: input.secrets,
    lite,
  };
}
