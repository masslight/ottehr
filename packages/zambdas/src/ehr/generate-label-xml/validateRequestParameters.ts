import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  OnDemandLabelXmlRequestInput,
  OnDemandLabelXmlRequestSchema,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): OnDemandLabelXmlRequestInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: unknown;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validatedParsed = safeValidate(OnDemandLabelXmlRequestSchema, params);

  if (validatedParsed.type === 'visit') {
    return {
      type: 'visit',
      encounterId: validatedParsed.encounterId,
      secrets,
      userToken,
    };
  } else {
    return {
      type: 'external-lab',
      serviceRequestId: validatedParsed.serviceRequestId,
      userTimezone: validatedParsed.userTimezone,
      secrets,
      userToken,
    };
  }
}
