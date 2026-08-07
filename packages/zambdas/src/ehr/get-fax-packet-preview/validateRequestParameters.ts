import {
  GetFaxPacketPreviewInput,
  GetFaxPacketPreviewInputSchema,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

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
