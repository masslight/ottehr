import { CreateNursingOrderInputSchema, CreateNursingOrderInputValidated } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CreateNursingOrderInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsedJSON = JSON.parse(input.body) as unknown;

  const { encounterId, notes } = CreateNursingOrderInputSchema.parse(parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    encounterId,
    notes,
    secrets: input.secrets,
    userToken,
  };
}
