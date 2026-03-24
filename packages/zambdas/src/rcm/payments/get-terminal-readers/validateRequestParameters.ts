import { Secrets } from 'utils';
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
    throw new Error('stripeAccountId is required');
  }

  if (!terminalLocationId || typeof terminalLocationId !== 'string') {
    throw new Error('terminalLocationId is required');
  }

  return {
    stripeAccountId,
    terminalLocationId,
    secrets: input.secrets,
  };
}
