import { CheckInInput } from 'utils';
import { ZambdaInput } from '../../shared';
import { CheckInInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CheckInInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId } = JSON.parse(input.body) as unknown as CheckInInput;

  // Check existence of necessary fields
  if (appointmentId === undefined) {
    throw new Error('appointment field is required');
  }

  if (!input.secrets) {
    throw new Error('secrets were not available');
  }

  return { appointmentId, secrets: input.secrets };
}
