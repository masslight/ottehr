import { GeneratePatientEducationInput, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const generatePatientEducationInputSchema: z.ZodType<GeneratePatientEducationInput> = z.object({
  icdCode: z.string().min(1, 'icdCode is required'),
  icdDescription: z.string().min(1, 'icdDescription is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): GeneratePatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeValidate(generatePatientEducationInputSchema, JSON.parse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
