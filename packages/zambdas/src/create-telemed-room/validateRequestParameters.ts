import { ZambdaInput } from '../types';
// TODO: validate request parameters after registration/onboarding is done
export function validateRequestParameters(input: ZambdaInput): any {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { body } = JSON.parse(input.body);

  // Check existence of necessary fields
  // if (body === undefined) {
  //   throw new Error('body field is required');
  // }

  return { body, secrets: input.secrets };
}
