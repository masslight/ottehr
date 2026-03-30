import { ChargeMasterDesignation, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DesignateChargeMasterEntryParams {
  chargeMasterId: string;
  designation: ChargeMasterDesignation;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DesignateChargeMasterEntryParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, designation } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (designation !== 'default-insurance' && designation !== 'self-pay') {
    throw INVALID_INPUT_ERROR('"designation" must be "default-insurance" or "self-pay"');
  }

  return {
    chargeMasterId,
    designation,
    secrets: input.secrets,
  };
}
