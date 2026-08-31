import { DeletePatientDocumentInput } from 'utils/lib/types/data/delete-patient-document.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const DeletePatientDocumentSchema = z.object({
  documentRefId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): DeletePatientDocumentInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body) as unknown;
  const { documentRefId } = safeValidate(DeletePatientDocumentSchema, parsed);

  return {
    documentRefId,
    secrets: input.secrets,
  };
}
