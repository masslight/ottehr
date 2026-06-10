import { MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

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

  const { stripeAccountId, terminalLocationId } = safeValidate(GetTerminalReadersBodySchema, JSON.parse(input.body));

  return {
    stripeAccountId,
    terminalLocationId,
    secrets: input.secrets,
  };
}
