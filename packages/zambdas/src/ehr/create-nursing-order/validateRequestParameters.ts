import { CreateNursingOrderInputSchema, CreateNursingOrderInputValidated } from 'utils/lib/types/data/orders/types';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

export function validateRequestParameters(input: ZambdaInput): CreateNursingOrderInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  const parsedJSON = safeJsonParse(input.body) as unknown;

  const { encounterId, notes } = safeValidate(CreateNursingOrderInputSchema, parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    encounterId,
    notes,
    secrets: input.secrets,
    userToken,
  };
}
