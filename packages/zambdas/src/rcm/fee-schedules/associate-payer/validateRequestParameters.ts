import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

const AssociatePayerBodySchema = z.object({
  feeScheduleId: z.string().uuid(),
  organizationId: z.string().min(1).optional(),
  locationId: z.string().uuid().optional(),
});

export interface AssociatePayerParams {
  feeScheduleId: string;
  organizationId?: string;
  locationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): AssociatePayerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, organizationId, locationId } = safeValidate(
    AssociatePayerBodySchema,
    safeJsonParse(input.body)
  );

  if (!organizationId && !locationId) {
    throw MISSING_REQUIRED_PARAMETERS(['organizationId or locationId']);
  }

  return {
    feeScheduleId,
    organizationId: organizationId || undefined,
    locationId: locationId || undefined,
    secrets: input.secrets,
  };
}
