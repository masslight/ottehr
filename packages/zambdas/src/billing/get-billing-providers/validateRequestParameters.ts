import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';
import { toNonNegativeInt } from '../shared';

export type ProviderType = 'rendering' | 'billing';

export interface GetBillingProvidersParams {
  providerType: ProviderType;
  offset?: number;
  pageSize?: number;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetBillingProvidersParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  if (!body.providerType) throw MISSING_REQUIRED_PARAMETERS(['providerType']);
  if (body.providerType !== 'rendering' && body.providerType !== 'billing') {
    throw INVALID_INPUT_ERROR('"providerType" must be "rendering" or "billing"');
  }

  return {
    providerType: body.providerType,
    offset: toNonNegativeInt(body.offset, 'offset'),
    pageSize: toNonNegativeInt(body.pageSize, 'pageSize'),
    secrets: input.secrets,
  };
}
