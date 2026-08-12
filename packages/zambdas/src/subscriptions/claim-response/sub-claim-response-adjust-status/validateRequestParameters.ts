import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../../shared';

export interface AdjustStatusInput {
  claimResponseId: string;
  secrets: Secrets;
}

const ClaimResponseBodySchema = z
  .object({
    resourceType: z.literal('ClaimResponse'),
    id: z.string().min(1),
  })
  .passthrough();

export function validateRequestParameters(input: ZambdaInput): AdjustStatusInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const claimResponse = safeValidate(ClaimResponseBodySchema, validateJsonBody(input));

  return {
    claimResponseId: claimResponse.id,
    secrets: input.secrets,
  };
}
