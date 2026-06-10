import { MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface SaveTerminalLocationInput {
  locationId: string;
  terminalLocationId: string | null;
  secrets: Secrets | null;
}

const SaveTerminalLocationBodySchema = z.object({
  locationId: z.string().uuid(),
  terminalLocationId: z.string().min(1).nullable().optional(),
});

export function validateRequestParameters(input: ZambdaInput): SaveTerminalLocationInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { locationId, terminalLocationId } = safeValidate(SaveTerminalLocationBodySchema, JSON.parse(input.body));

  return {
    locationId,
    terminalLocationId: terminalLocationId ?? null,
    secrets: input.secrets,
  };
}
