import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../../shared';

export interface CmDisassociatePayerParams {
  chargeMasterId: string;
  organizationId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmDisassociatePayerParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, organizationId } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw MISSING_REQUIRED_PARAMETERS(['chargeMasterId']);
  }

  if (!organizationId) {
    throw MISSING_REQUIRED_PARAMETERS(['organizationId']);
  }

  return {
    chargeMasterId,
    organizationId,
    secrets: input.secrets,
  };
}
