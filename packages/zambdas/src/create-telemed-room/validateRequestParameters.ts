import { ZambdaInput } from '../types';

// Note that this file is copied from BH and needs significant changes
export function validateRequestParameters(input: ZambdaInput): any {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { body } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (body === undefined) {
    throw new Error('body field is required');
  }

  return { body, secrets: input.secrets };
}
