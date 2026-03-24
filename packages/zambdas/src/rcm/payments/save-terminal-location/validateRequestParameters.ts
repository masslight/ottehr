import { Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface SaveTerminalLocationInput {
  locationId: string;
  terminalLocationId: string | null;
  secrets: Secrets | null;
}

export function validateRequestParameters(input: ZambdaInput): SaveTerminalLocationInput {
  const parsed = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
  const locationId = parsed?.locationId;

  if (!locationId || typeof locationId !== 'string') {
    throw new Error('locationId is required');
  }

  const terminalLocationId = parsed?.terminalLocationId ?? null;
  if (terminalLocationId !== null && typeof terminalLocationId !== 'string') {
    throw new Error('terminalLocationId must be a string or null');
  }

  return {
    locationId,
    terminalLocationId,
    secrets: input.secrets,
  };
}
