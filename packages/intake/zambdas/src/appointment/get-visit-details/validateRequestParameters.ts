import { GetVisitDetailsRequest } from 'utils';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): GetVisitDetailsRequest & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId } = JSON.parse(input.body);

  if (!appointmentId) {
    throw new Error('appointmentID is not defined');
  }

  return {
    appointmentId,
    secrets: input.secrets,
  };
}
