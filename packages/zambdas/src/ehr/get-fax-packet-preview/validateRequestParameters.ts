import { GetFaxPacketPreviewInput, GetFaxPacketPreviewInputSchema } from 'utils/lib/types/api/fax.types';
import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): GetFaxPacketPreviewInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentId } = safeValidate(GetFaxPacketPreviewInputSchema, safeJsonParse(input.body));

  return { appointmentId, secrets: input.secrets };
}
