import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface CmAssociateLocationParams {
  chargeMasterId: string;
  locationId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmAssociateLocationParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, locationId } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (!locationId) {
    throw MISSING_REQUIRED_PARAMETERS(['locationId']);
  }

  return {
    chargeMasterId,
    locationId,
    secrets: input.secrets,
  };
}
