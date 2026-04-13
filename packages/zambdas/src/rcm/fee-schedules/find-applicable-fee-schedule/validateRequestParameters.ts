import { INVALID_INPUT_ERROR, isValidUUID, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface FindApplicableFeeScheduleParams {
  payerOrganizationId?: string;
  dateOfService: string;
  locationId?: string;
  employerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): FindApplicableFeeScheduleParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { payerOrganizationId, dateOfService, locationId, employerOrganizationId } = JSON.parse(input.body);

  if (!payerOrganizationId && !employerOrganizationId) {
    throw MISSING_REQUIRED_PARAMETERS(['payerOrganizationId or employerOrganizationId']);
  }

  if (!dateOfService || typeof dateOfService !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfService)) {
    throw INVALID_INPUT_ERROR('"dateOfService" is required and must be a date string (YYYY-MM-DD)');
  }

  if (payerOrganizationId && !isValidUUID(payerOrganizationId)) {
    throw INVALID_INPUT_ERROR('"payerOrganizationId" must be a valid UUID');
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
