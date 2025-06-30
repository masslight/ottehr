import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, SubmitLabOrderInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SubmitLabOrderInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { serviceRequestID, accountNumber, data, specimens } = JSON.parse(input.body) as SubmitLabOrderInput;

  const missingResources = [];
  if (!serviceRequestID) missingResources.push('serviceRequestID');
  if (!accountNumber) missingResources.push('accountNumber');
  if (!data) missingResources.push('data');

  if (specimens && !Object.values(specimens).every((specimen) => typeof specimen.date === 'string')) {
    missingResources.push('specimens');
  }

  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  return {
    serviceRequestID,
    accountNumber,
    data,
    secrets: input.secrets,
    specimens,
  };
}
