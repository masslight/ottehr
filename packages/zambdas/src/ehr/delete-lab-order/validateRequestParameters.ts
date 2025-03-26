import { ZambdaInput } from 'zambda-utils';

export interface DeleteLabOrderParams {
  labOrderId: string;
  encounterId: string;
  secrets: any;
}

export function validateRequestParameters(input: ZambdaInput): DeleteLabOrderParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { labOrderId, encounterId } = JSON.parse(input.body);

  if (!labOrderId) {
    throw new Error('missing required parameter: labOrderId');
  }

  if (!encounterId) {
    throw new Error('missing required parameter: encounterId');
  }

  return {
    labOrderId,
    encounterId,
    secrets: input.secrets,
  };
}
