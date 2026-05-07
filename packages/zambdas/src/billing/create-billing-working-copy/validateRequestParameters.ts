import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';
import { ALLOWED_BILLING_RESOURCE_TYPES, BillingResourceType, sanitizeOverrides } from '../shared';

export interface CreateWorkingCopyParams {
  resourceType: BillingResourceType;
  resourceId: string;
  overrides?: Record<string, unknown>;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateWorkingCopyParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  const missing: string[] = [];
  if (!body.resourceType) missing.push('resourceType');
  if (!body.resourceId) missing.push('resourceId');
  if (missing.length) throw MISSING_REQUIRED_PARAMETERS(missing);

  if (typeof body.resourceType !== 'string' || !ALLOWED_BILLING_RESOURCE_TYPES.includes(body.resourceType)) {
    throw INVALID_INPUT_ERROR(`"resourceType" must be one of: ${ALLOWED_BILLING_RESOURCE_TYPES.join(', ')}`);
  }
  if (typeof body.resourceId !== 'string' || !body.resourceId.trim()) {
    throw INVALID_INPUT_ERROR('"resourceId" must be a non-empty string');
  }

  return {
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    overrides: sanitizeOverrides(body.overrides),
    secrets: input.secrets,
  };
}
