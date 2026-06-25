import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DisassociatePayerParams {
  feeScheduleId: string;
  organizationId?: string;
  locationId?: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DisassociatePayerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, organizationId, locationId } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (!organizationId && !locationId) {
    throw MISSING_REQUIRED_PARAMETERS(['organizationId or locationId']);
  }

  return {
    feeScheduleId,
    organizationId: organizationId || undefined,
    locationId: locationId || undefined,
    secrets: input.secrets,
  };
}
