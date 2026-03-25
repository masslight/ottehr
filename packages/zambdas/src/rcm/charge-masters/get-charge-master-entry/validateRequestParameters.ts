import { ChargeMasterDesignation, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetChargeMasterEntryParams {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
  dateOfService?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetChargeMasterEntryParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { designation, payerOrganizationId, dateOfService } = JSON.parse(input.body);

  if (designation !== 'default-insurance' && designation !== 'self-pay') {
    throw INVALID_INPUT_ERROR('"designation" must be "default-insurance" or "self-pay"');
  }

  return {
    designation,
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService: dateOfService || undefined,
    secrets: input.secrets,
  };
}
