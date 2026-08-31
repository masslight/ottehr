import {
  GeneratePatientEducationInput,
  PATIENT_EDUCATION_LANGUAGES,
} from 'utils/lib/types/data/patient-education.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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

  const parsed = safeValidate(generatePatientEducationInputSchema, safeJsonParse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
