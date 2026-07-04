import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, UpdateApprovedPatientEducationCodesInput } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const icdCodeSchema = z.object({
  code: z.string().min(1, 'Each icdCode must have a code'),
  display: z.string(),
});

const updateApprovedPatientEducationCodesInputSchema: z.ZodType<UpdateApprovedPatientEducationCodesInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
  icdCodes: z.array(icdCodeSchema).min(1, 'icdCodes must be a non-empty array'),
});

export function validateRequestParameters(
  input: ZambdaInput
): UpdateApprovedPatientEducationCodesInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(updateApprovedPatientEducationCodesInputSchema, safeJsonParse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
