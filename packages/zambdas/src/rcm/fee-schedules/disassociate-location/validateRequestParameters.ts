import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface DisassociateLocationParams {
  feeScheduleId: string;
  locationId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DisassociateLocationParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { feeScheduleId, locationId } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['feeScheduleId']);
  }

  if (!locationId) {
    throw MISSING_REQUIRED_PARAMETERS(['locationId']);
  }

  return {
    feeScheduleId,
    locationId,
    secrets: input.secrets,
  };
}
