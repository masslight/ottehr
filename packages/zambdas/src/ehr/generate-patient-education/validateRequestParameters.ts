import {
  GeneratePatientEducationInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PATIENT_EDUCATION_LANGUAGES,
} from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const generatePatientEducationInputSchema: z.ZodType<GeneratePatientEducationInput> = z.object({
  icdCode: z.string().min(1, 'icdCode is required'),
  icdDescription: z.string().min(1, 'icdDescription is required'),
  language: z.enum(PATIENT_EDUCATION_LANGUAGES).optional(),
});

export function validateRequestParameters(
  input: ZambdaInput
): GeneratePatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(generatePatientEducationInputSchema, JSON.parse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
