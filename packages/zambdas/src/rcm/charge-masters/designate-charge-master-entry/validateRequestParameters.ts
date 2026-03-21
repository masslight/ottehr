import { ChargeMasterDesignation } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DesignateChargeMasterEntryParams {
  chargeMasterId: string;
  designation: ChargeMasterDesignation;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DesignateChargeMasterEntryParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { chargeMasterId, designation } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw new Error('This field is required: "chargeMasterId"');
  }

  if (designation !== 'insurance-pay' && designation !== 'self-pay') {
    throw new Error('"designation" must be "insurance-pay" or "self-pay"');
  }

  return {
    chargeMasterId,
    designation,
    secrets: input.secrets,
  };
}
