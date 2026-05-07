import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export interface GetClaimDetailParams {
  claimId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetClaimDetailParams {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let body: any;
  try {
    body = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body is not valid JSON');
  }

  if (!body.claimId) throw MISSING_REQUIRED_PARAMETERS(['claimId']);
  if (typeof body.claimId !== 'string' || !body.claimId.trim()) {
    throw INVALID_INPUT_ERROR('"claimId" must be a non-empty string');
  }

  return { claimId: body.claimId, secrets: input.secrets };
}
