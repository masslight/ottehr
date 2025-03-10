import { ZambdaInput } from 'zambda-utils';

export interface GetLabOrdersParams {
  encounterId: string;
  secrets: any;
}

export function validateRequestParameters(input: ZambdaInput): GetLabOrdersParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId } = JSON.parse(input.body);

  if (!encounterId) {
    throw new Error('missing required parameter: patientId');
  }

  return {
    encounterId,
    secrets: input.secrets,
  };
}
