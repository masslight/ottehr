import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  OnDemandLabelXmlRequestInput,
  OnDemandLabelXmlRequestSchema,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(
  input: ZambdaInput
): OnDemandLabelXmlRequestInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: OnDemandLabelXmlRequestInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validatedParsed = OnDemandLabelXmlRequestSchema.safeParse(params);
  if (!validatedParsed.success) {
    console.error(
      'Hit validation error during zod parsing. Tried to parse this json:',
      JSON.stringify(validatedParsed.error.errors),
      JSON.stringify(params)
    );
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(validatedParsed.error.errors)}`);
  }

  if (validatedParsed.data.type === 'visit') {
    return {
      type: 'visit',
      encounterId: validatedParsed.data.encounterId,
      secrets,
      userToken,
    };
  } else {
    return {
      type: 'external-lab',
      serviceRequestId: validatedParsed.data.serviceRequestId,
      userTimezone: validatedParsed.data.userTimezone,
      secrets,
      userToken,
    };
  }
}
