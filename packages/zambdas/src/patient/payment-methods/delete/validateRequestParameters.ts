import Oystehr from '@oystehr/sdk';
import { isValidUUID, PaymentMethodDeleteParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';
import { getStripeCustomerId } from '../helpers';

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodDeleteParameters & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { beneficiaryPatientId, paymentMethodId, appointmentId } = JSON.parse(input.body);

  if (!beneficiaryPatientId) {
    throw new Error('beneficiaryPatientId is not defined');
  }

  if (!paymentMethodId) {
    throw new Error('paymentMethodId is not defined');
  }

  if (!appointmentId) {
    throw new Error('appointmentId is not defined');
  }

  if (!isValidUUID(appointmentId)) {
    throw new Error('appointmentId is not a valid UUID');
  }

  return {
    beneficiaryPatientId,
    paymentMethodId,
    appointmentId,
    secrets: input.secrets,
  };
}

interface ComplexValidationInput {
  patientId: string;
  appointmentId: string;
  oystehrClient: Oystehr;
}
export async function complexValidation(input: ComplexValidationInput): Promise<{ stripeCustomerId: string }> {
  return getStripeCustomerId(input);
}
