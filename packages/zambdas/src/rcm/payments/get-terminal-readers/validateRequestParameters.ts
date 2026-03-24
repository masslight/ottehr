import { MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetTerminalReadersInput {
  stripeAccountId: string;
  terminalLocationId: string;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): GetTerminalReadersInput {
  const parsed = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
  const stripeAccountId = parsed?.stripeAccountId;
  const terminalLocationId = parsed?.terminalLocationId;

  if (!stripeAccountId || typeof stripeAccountId !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['stripeAccountId']);
  }

  if (!terminalLocationId || typeof terminalLocationId !== 'string') {
    throw MISSING_REQUIRED_PARAMETERS(['terminalLocationId']);
  }

  return {
    stripeAccountId,
    terminalLocationId,
    secrets: input.secrets,
  };
}
