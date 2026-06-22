import { INVALID_INPUT_ERROR, isAlphaNumericID, isValidUUID, MISSING_REQUEST_BODY } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface FindApplicableChargeMasterParams {
  payerOrganizationId?: string;
  dateOfService: string;
  locationId?: string;
  employerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): FindApplicableChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { payerOrganizationId, dateOfService, locationId, employerOrganizationId } = JSON.parse(input.body);

  if (!dateOfService || typeof dateOfService !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfService)) {
    throw INVALID_INPUT_ERROR('"dateOfService" is required and must be a date string (YYYY-MM-DD)');
  }

  if (payerOrganizationId && !isAlphaNumericID(payerOrganizationId)) {
    throw INVALID_INPUT_ERROR('"payerOrganizationId" must be a valid ID (alphanumeric, hyphens, or underscores)');
  }
  if (locationId && !isValidUUID(locationId)) {
    throw INVALID_INPUT_ERROR('"locationId" must be a valid UUID');
  }
  if (employerOrganizationId && !isValidUUID(employerOrganizationId)) {
    throw INVALID_INPUT_ERROR('"employerOrganizationId" must be a valid UUID');
  }

  return {
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService,
    locationId: locationId || undefined,
    employerOrganizationId: employerOrganizationId || undefined,
    secrets: input.secrets,
  };
}
