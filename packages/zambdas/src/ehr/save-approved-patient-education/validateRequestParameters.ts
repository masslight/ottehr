import {
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PATIENT_EDUCATION_LANGUAGES,
  SaveApprovedPatientEducationInput,
} from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

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

  const parsed = safeValidate(saveApprovedPatientEducationInputSchema, JSON.parse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
