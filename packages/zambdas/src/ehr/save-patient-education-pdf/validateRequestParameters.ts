import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, SavePatientEducationPdfInput } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const PATIENT_TITLE_MAX_LENGTH = 150;

const patientEducationSectionSchema = z.object({
  content: z.string(),
  patientTitle: z
    .string()
    .min(1, 'patientTitle is required')
    .max(PATIENT_TITLE_MAX_LENGTH, `patientTitle must be ${PATIENT_TITLE_MAX_LENGTH} characters or less`),
  icdCode: z.string(),
  icdDescription: z.string(),
});

function isValidPdfBase64(value: string): boolean {
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(value)) return false;

  try {
    const headerBytes = Buffer.from(value.slice(0, 8), 'base64');
    return headerBytes.length >= 5 && headerBytes.subarray(0, 5).toString('ascii') === '%PDF-';
  } catch {
    return false;
  }
}

const baseFields = {
  encounterId: z.string().min(1, 'encounterId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  title: z.string().min(1, 'title is required'),
};

const savePatientEducationPdfInputSchema: z.ZodType<SavePatientEducationPdfInput> = z.union([
  z.object({
    ...baseFields,
    sections: z.array(patientEducationSectionSchema).min(1, 'sections must be a non-empty array'),
    pdfBase64: z.undefined(),
  }),
  z.object({
    ...baseFields,
    pdfBase64: z
      .string()
      .min(1, 'pdfBase64 must be a non-empty string')
      .max(8_000_000, 'pdfBase64 is too large')
      .refine(isValidPdfBase64, 'pdfBase64 must decode to a valid PDF payload'),
    sections: z.undefined(),
  }),
]);

export function validateRequestParameters(
  input: ZambdaInput
): SavePatientEducationPdfInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(savePatientEducationPdfInputSchema, safeJsonParse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
