import { Operation } from 'fast-json-patch';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';
import { ALLOWED_BILLING_RESOURCE_TYPES, BillingResourceType } from '../shared';

const VALID_OPS = new Set(['add', 'replace', 'remove']);

export interface UpdateBillingClaimParams {
  resourceId: string;
  resourceType: BillingResourceType | 'Claim';
  operations: Operation[];
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): UpdateBillingClaimParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  if (!body.resourceId) throw MISSING_REQUIRED_PARAMETERS(['resourceId']);
  if (typeof body.resourceId !== 'string' || !body.resourceId.trim()) {
    throw INVALID_INPUT_ERROR('"resourceId" must be a non-empty string');
  }

  const resourceType = body.resourceType || 'Claim';
  const allowed = [...ALLOWED_BILLING_RESOURCE_TYPES, 'Claim'];
  if (!allowed.includes(resourceType)) {
    throw INVALID_INPUT_ERROR(`"resourceType" must be one of: ${allowed.join(', ')}`);
  }

  if (!Array.isArray(body.operations) || body.operations.length === 0) {
    throw INVALID_INPUT_ERROR('"operations" must be a non-empty array');
  }

  for (const op of body.operations) {
    if (!op || typeof op !== 'object') throw INVALID_INPUT_ERROR('Each operation must be an object');
    if (!VALID_OPS.has(op.op)) throw INVALID_INPUT_ERROR(`"op" must be one of: add, replace, remove`);
    if (typeof op.path !== 'string' || !op.path.startsWith('/')) {
      throw INVALID_INPUT_ERROR('"path" must be a string starting with /');
    }
  }

  return {
    resourceId: body.resourceId,
    resourceType,
    operations: body.operations,
    secrets: input.secrets,
  };
}
