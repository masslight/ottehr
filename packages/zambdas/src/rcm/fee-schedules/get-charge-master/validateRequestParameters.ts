import { ChargeMasterDesignation } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface GetChargeMasterParams {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): GetChargeMasterParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { designation, payerOrganizationId } = JSON.parse(input.body);

  if (designation !== 'insurance-pay' && designation !== 'self-pay') {
    throw new Error('"designation" must be "insurance-pay" or "self-pay"');
  }

  return {
    designation,
    payerOrganizationId: payerOrganizationId || undefined,
    secrets: input.secrets,
  };
}
