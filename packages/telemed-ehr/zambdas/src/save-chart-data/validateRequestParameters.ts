import { SaveChartDataRequest } from 'ehr-utils';
import { ZambdaInput } from '../types';

export function validateRequestParameters(input: ZambdaInput): SaveChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const data = JSON.parse(input.body) as SaveChartDataRequest;

  if (data.encounterId === undefined) {
    throw new Error('These fields are required: "encounterId"');
  }

  return { ...data, secrets: input.secrets };
}
