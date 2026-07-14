import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface CmDisassociatePayerParams {
  chargeMasterId: string;
  organizationId?: string;
  locationId?: string;
  secrets: ZambdaInput['secrets'];
}

const CmDisassociatePayerBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  organizationId: z.string().min(1).optional(),
  locationId: z.string().uuid().optional(),
});

export function validateRequestParameters(input: ZambdaInput): CmDisassociatePayerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, organizationId, locationId } = safeValidate(
    CmDisassociatePayerBodySchema,
    safeJsonParse(input.body)
  );

  if (!organizationId && !locationId) {
    throw INVALID_INPUT_ERROR('"organizationId" or "locationId" is required');
  }

  return {
    chargeMasterId,
    organizationId: organizationId || undefined,
    locationId: locationId || undefined,
    secrets: input.secrets,
  };
}
