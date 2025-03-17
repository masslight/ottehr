import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { CheckInInput } from '.';

// Note that this file is copied from BH and needs significant changes
export function validateRequestParameters(input: ZambdaInput): CheckInInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointment } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (appointment === undefined) {
    throw new Error('appointment field is required');
  }

  return { appointment, secrets: input.secrets };
}
