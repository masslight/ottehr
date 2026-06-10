import { MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface FindApplicableChargeMasterParams {
  payerOrganizationId?: string;
  dateOfService: string;
  locationId?: string;
  employerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

const FindApplicableChargeMasterBodySchema = z.object({
  payerOrganizationId: z.string().min(1).optional(),
  dateOfService: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '"dateOfService" must be a date string (YYYY-MM-DD)'),
  locationId: z.string().uuid().optional(),
  employerOrganizationId: z.string().uuid().optional(),
});

export function validateRequestParameters(input: ZambdaInput): FindApplicableChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { payerOrganizationId, dateOfService, locationId, employerOrganizationId } = safeValidate(
    FindApplicableChargeMasterBodySchema,
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
