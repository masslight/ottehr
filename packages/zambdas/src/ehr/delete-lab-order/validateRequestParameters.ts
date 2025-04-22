import { ZambdaInput } from '../../shared';

export interface DeleteLabOrderParams {
  serviceRequestId: string;
  secrets: any;
}

export function validateRequestParameters(input: ZambdaInput): DeleteLabOrderParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { serviceRequestId } = JSON.parse(input.body);

  if (!serviceRequestId) {
    throw new Error('missing required parameter: serviceRequestId');
  }

  return {
    serviceRequestId,
    secrets: input.secrets,
  };
}
