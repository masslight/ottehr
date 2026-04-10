import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface FindApplicableChargeMasterParams {
  payerOrganizationId?: string;
  dateOfService: string;
  locationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): FindApplicableChargeMasterParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { payerOrganizationId, dateOfService, locationId } = JSON.parse(input.body);

  if (!dateOfService || typeof dateOfService !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfService)) {
    throw INVALID_INPUT_ERROR('"dateOfService" is required and must be a date string (YYYY-MM-DD)');
  }

  return {
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService,
    locationId: locationId || undefined,
    secrets: input.secrets,
  };
}
