import { DeleteApprovedPatientEducationInput } from 'utils/lib/types/api/approved-patient-education.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const deleteApprovedPatientEducationInputSchema: z.ZodType<DeleteApprovedPatientEducationInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): DeleteApprovedPatientEducationInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsed = safeValidate(deleteApprovedPatientEducationInputSchema, safeJsonParse(input.body));

  return {
    ...parsed,
    secrets: input.secrets,
  };
}
