import { GetChartDataRequest } from 'ehr-utils';
import { ZambdaInput } from '../types';

export function validateRequestParameters(input: ZambdaInput): GetChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId } = JSON.parse(input.body);

  if (encounterId === undefined) {
    throw new Error('These fields are required: "encounterId"');
  }

  return {
    encounterId: encounterId,
    secrets: input.secrets,
  };
}
