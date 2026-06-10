import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface FindApplicableFeeScheduleParams {
  payerOrganizationId?: string;
  dateOfService: string;
  locationId?: string;
  employerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

const FindApplicableFeeScheduleBodySchema = z
  .object({
    payerOrganizationId: z.string().min(1).optional(),
    dateOfService: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '"dateOfService" must be a date string (YYYY-MM-DD)'),
    locationId: z.string().uuid().optional(),
    employerOrganizationId: z.string().uuid().optional(),
  })
  .refine((data) => data.payerOrganizationId || data.employerOrganizationId, {
    message: 'payerOrganizationId or employerOrganizationId is required',
  });

export function validateRequestParameters(input: ZambdaInput): FindApplicableFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { payerOrganizationId, dateOfService, locationId, employerOrganizationId } = safeValidate(
    FindApplicableFeeScheduleBodySchema,
    JSON.parse(input.body)
  );

  return {
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService,
    locationId: locationId || undefined,
    employerOrganizationId: employerOrganizationId || undefined,
    secrets: input.secrets,
  };
}
