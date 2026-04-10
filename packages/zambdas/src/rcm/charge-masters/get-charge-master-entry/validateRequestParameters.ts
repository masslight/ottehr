import { ChargeMasterDesignation, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetChargeMasterEntryParams {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
  dateOfService?: string;
  locationId?: string;
  employerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetChargeMasterEntryParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { designation, payerOrganizationId, dateOfService, locationId, employerOrganizationId } = JSON.parse(
    input.body
  );

  if (designation !== 'default-insurance' && designation !== 'self-pay') {
    throw INVALID_INPUT_ERROR('"designation" must be "default-insurance" or "self-pay"');
  }

  return {
    designation,
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService: dateOfService || undefined,
    locationId: locationId || undefined,
    employerOrganizationId: employerOrganizationId || undefined,
    secrets: input.secrets,
  };
}
