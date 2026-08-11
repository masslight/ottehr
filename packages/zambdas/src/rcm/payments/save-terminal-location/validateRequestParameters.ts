import { Secrets } from 'utils/lib/secrets';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

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

  const { locationId, terminalLocationId } = safeValidate(SaveTerminalLocationBodySchema, safeJsonParse(input.body));

  return {
    locationId,
    terminalLocationId: terminalLocationId ?? null,
    secrets: input.secrets,
  };
}
