import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, SavePatientEducationPdfInput } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const patientEducationSectionSchema = z.object({
  content: z.string(),
  patientTitle: z.string(),
  icdCode: z.string(),
  icdDescription: z.string(),
});

const savePatientEducationPdfInputSchema: z.ZodType<SavePatientEducationPdfInput> = z.object({
  encounterId: z.string().min(1, 'encounterId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  title: z.string().min(1, 'title is required'),
  sections: z.array(patientEducationSectionSchema).min(1, 'sections must be a non-empty array'),
});

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientEducationPdfInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(savePatientEducationPdfInputSchema, JSON.parse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
