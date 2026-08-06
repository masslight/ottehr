import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { PATIENT_EDUCATION_LANGUAGES } from 'utils/lib/types/data/patient-education.types';
import { SaveApprovedPatientEducationInput } from 'utils/lib/types/api/approved-patient-education.types';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const icdCodeSchema = z.object({
  code: z.string().min(1, 'Each icdCodes entry must have a code'),
  display: z.string(),
});

const saveApprovedPatientEducationInputSchema: z.ZodType<SaveApprovedPatientEducationInput> = z.object({
  pdfBase64: z.string().min(1, 'pdfBase64 is required'),
  title: z.string().min(1, 'title is required'),
  icdCodes: z.array(icdCodeSchema).min(1, 'icdCodes must be a non-empty array'),
  language: z.enum(PATIENT_EDUCATION_LANGUAGES).optional(),
});

export function validateRequestParameters(
  input: ZambdaInput
): SaveApprovedPatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(saveApprovedPatientEducationInputSchema, safeJsonParse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
