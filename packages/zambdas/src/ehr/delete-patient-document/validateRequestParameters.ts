import { DeletePatientDocumentInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const DeletePatientDocumentSchema = z.object({
  documentRefId: z.string().trim().min(1),
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

  const parsed = JSON.parse(input.body) as unknown;
  const { documentRefId } = safeValidate(DeletePatientDocumentSchema, parsed);

  return {
    documentRefId,
    secrets: input.secrets,
  };
}
