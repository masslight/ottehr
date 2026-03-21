import { ZambdaInput } from '../../../shared';

export interface CmDisassociatePayerParams {
  chargeMasterId: string;
  organizationId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CmDisassociatePayerParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { chargeMasterId, organizationId } = JSON.parse(input.body);

  if (!chargeMasterId) {
    throw new Error('This field is required: "chargeMasterId"');
  }

  if (!organizationId) {
    throw new Error('This field is required: "organizationId"');
  }

  return {
    chargeMasterId,
    organizationId,
    secrets: input.secrets,
  };
}
