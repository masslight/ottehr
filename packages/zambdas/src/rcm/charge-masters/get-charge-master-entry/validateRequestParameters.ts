import { ChargeMasterDesignation, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

export interface GetChargeMasterEntryParams {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
  dateOfService?: string;
  locationId?: string;
  employerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

const alphaNumericIdRegex = /^(?=.*[a-zA-Z0-9])[a-zA-Z0-9_-]{1,64}$/;

const bodySchema = z.object({
  designation: z.enum(['default-insurance', 'self-pay']),
  payerOrganizationId: z
    .string()
    .regex(alphaNumericIdRegex, '"payerOrganizationId" must be a valid ID (alphanumeric, hyphens, or underscores)')
    .optional()
    .or(z.literal('')),
  dateOfService: z.string().date().optional().or(z.literal('')),
  locationId: z.string().uuid('"locationId" must be a valid UUID').optional().or(z.literal('')),
  employerOrganizationId: z.string().uuid('"employerOrganizationId" must be a valid UUID').optional().or(z.literal('')),
});

export function validateRequestParameters(input: ZambdaInput): GetChargeMasterEntryParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { designation, payerOrganizationId, dateOfService, locationId, employerOrganizationId } = safeValidate(
    bodySchema,
    parsed
  );

  return {
    designation,
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService: dateOfService || undefined,
    locationId: locationId || undefined,
    employerOrganizationId: employerOrganizationId || undefined,
    secrets: input.secrets,
  };
}
