import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface GetTerminalReadersInput {
  stripeAccountId: string;
  terminalLocationId: string;
  secrets: Secrets | null;
}

const GetTerminalReadersBodySchema = z.object({
  stripeAccountId: z.string().min(1),
  terminalLocationId: z.string().min(1),
});

export function validateRequestParameters(input: ZambdaInput): GetTerminalReadersInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { stripeAccountId, terminalLocationId } = safeValidate(GetTerminalReadersBodySchema, safeJsonParse(input.body));

  return {
    stripeAccountId,
    terminalLocationId,
    secrets: input.secrets,
  };
}
