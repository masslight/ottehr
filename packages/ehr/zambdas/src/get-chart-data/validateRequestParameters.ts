import { GetChartDataRequest } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): GetChartDataRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId, requestedFields } = JSON.parse(input.body);

  if (encounterId === undefined) {
    throw new Error('These fields are required: "encounterId"');
  }

  return {
    encounterId: encounterId,
    secrets: input.secrets,
    requestedFields,
  };
}
