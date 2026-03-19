import { ZambdaInput } from '../../../shared';

export interface DisassociatePayerParams {
  feeScheduleId: string;
  organizationId: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): DisassociatePayerParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { feeScheduleId, organizationId } = JSON.parse(input.body);

  if (!feeScheduleId) {
    throw new Error('This field is required: "feeScheduleId"');
  }

  if (!organizationId) {
    throw new Error('This field is required: "organizationId"');
  }

  return {
    feeScheduleId,
    organizationId,
    secrets: input.secrets,
  };
}
