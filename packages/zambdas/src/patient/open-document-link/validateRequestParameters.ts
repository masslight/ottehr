import { OpenDocumentLinkInput, OpenDocumentLinkInputSchema } from 'utils/lib/types/api/fax.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): OpenDocumentLinkInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { token } = safeValidate(OpenDocumentLinkInputSchema, safeJsonParse(input.body));

  return { token, secrets: input.secrets };
}
