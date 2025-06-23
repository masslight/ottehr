import { CheckInInputValidated } from '.';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): CheckInInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointment } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (appointment === undefined) {
    throw new Error('appointment field is required');
  }

  if (!input.secrets) {
    throw new Error('secrets were not available');
  }

  return { appointmentId: appointment, secrets: input.secrets };
}
