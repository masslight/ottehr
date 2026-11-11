import {
  GetDocumentPacketPreviewInput,
  GetDocumentPacketPreviewInputSchema,
} from 'utils/lib/types/api/document-packet.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): GetDocumentPacketPreviewInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentId, medicalRecord } = safeValidate(GetDocumentPacketPreviewInputSchema, safeJsonParse(input.body));

  return { appointmentId, medicalRecord, secrets: input.secrets };
}
