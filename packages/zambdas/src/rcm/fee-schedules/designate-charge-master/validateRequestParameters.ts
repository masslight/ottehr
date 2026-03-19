import { ChargeMasterDesignation } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DesignateChargeMasterParams {
  feeScheduleId: string;
  designation: ChargeMasterDesignation;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DesignateChargeMasterParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, designation } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (designation !== 'insurance-pay' && designation !== 'self-pay') {
    throw new Error('"designation" must be "insurance-pay" or "self-pay"');
  }

  return {
    feeScheduleId,
    designation,
    secrets: input.secrets,
  };
}
