import { INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, Secrets } from 'utils';
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
    throw MISSING_REQUIRED_PARAMETERS(['locationId']);
  }

  const terminalLocationId = parsed?.terminalLocationId ?? null;
  if (terminalLocationId !== null && typeof terminalLocationId !== 'string') {
    throw INVALID_INPUT_ERROR('terminalLocationId must be a string or null');
  }
  if (typeof terminalLocationId === 'string' && terminalLocationId.trim() === '') {
    throw INVALID_INPUT_ERROR('terminalLocationId must not be an empty string');
  }

  return {
    locationId,
    terminalLocationId,
    secrets: input.secrets,
  };
}
