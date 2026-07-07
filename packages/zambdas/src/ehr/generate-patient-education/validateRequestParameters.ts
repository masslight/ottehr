import { GeneratePatientEducationInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const generatePatientEducationInputSchema: z.ZodType<GeneratePatientEducationInput> = z.object({
  icdCode: z.string().min(1, 'icdCode is required'),
  icdDescription: z.string().min(1, 'icdDescription is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): GeneratePatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(generatePatientEducationInputSchema, safeJsonParse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
