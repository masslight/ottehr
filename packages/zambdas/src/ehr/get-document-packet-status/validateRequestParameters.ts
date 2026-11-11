import {
  GetDocumentPacketStatusInput,
  GetDocumentPacketStatusInputSchema,
} from 'utils/lib/types/api/document-packet.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): GetDocumentPacketStatusInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { taskId } = safeValidate(GetDocumentPacketStatusInputSchema, safeJsonParse(input.body));

  return { taskId, secrets: input.secrets };
}
