import { ChargeMasterDesignation } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetChargeMasterEntryParams {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
  dateOfService?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetChargeMasterEntryParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { designation, payerOrganizationId, dateOfService } = JSON.parse(input.body);

  if (designation !== 'default-insurance' && designation !== 'self-pay') {
    throw new Error('"designation" must be "default-insurance" or "self-pay"');
  }

  return {
    designation,
    payerOrganizationId: payerOrganizationId || undefined,
    dateOfService: dateOfService || undefined,
    secrets: input.secrets,
  };
}
