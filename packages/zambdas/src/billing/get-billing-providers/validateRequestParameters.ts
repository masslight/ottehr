import { INVALID_INPUT_ERROR } from 'utils';
import { ZambdaInput } from '../../shared';

export interface GetBillingProvidersParams {
  providerType?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingProvidersParams {
  if (input.body) {
    let body: any;
    try {
      body = JSON.parse(input.body);
    } catch {
      throw INVALID_INPUT_ERROR('Request body is not valid JSON');
    }

    if (body.providerType !== undefined && (typeof body.providerType !== 'string' || !body.providerType.trim())) {
      throw INVALID_INPUT_ERROR('"providerType" must be a non-empty string when provided');
    }

    return { providerType: body.providerType, secrets: input.secrets };
  } else return { secrets: input.secrets };
}
