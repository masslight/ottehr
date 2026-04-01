import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface AssociatePayerParams {
  feeScheduleId: string;
  organizationId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): AssociatePayerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, organizationId } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (!organizationId) {
    throw MISSING_REQUIRED_PARAMETERS(['organizationId']);
  }

  return {
    feeScheduleId,
    organizationId,
    secrets: input.secrets,
  };
}
