import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface DisassociatePayerParams {
  feeScheduleId: string;
  organizationId?: string;
  locationId?: string;
  secrets: ZambdaInput['secrets'];
}

const DisassociatePayerBodySchema = z
  .object({
    feeScheduleId: z.string().uuid(),
    organizationId: z.string().min(1).optional(),
    locationId: z.string().uuid().optional(),
  })
  .refine((data) => data.organizationId || data.locationId, {
    message: 'organizationId or locationId is required',
  });

export function validateRequestParameters(input: ZambdaInput): DisassociatePayerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, organizationId, locationId } = safeValidate(
    DisassociatePayerBodySchema,
    safeJsonParse(input.body)
  );

  return {
    feeScheduleId,
    organizationId: organizationId || undefined,
    locationId: locationId || undefined,
    secrets: input.secrets,
  };
}
