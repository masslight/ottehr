import {
  GetFaxPacketStatusInput,
  GetFaxPacketStatusInputSchema,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetFaxPacketStatusInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { taskId } = safeValidate(GetFaxPacketStatusInputSchema, safeJsonParse(input.body));

  return { taskId, secrets: input.secrets };
}
