import Oystehr from '@oystehr/sdk';
import { PaymentMethodDeleteParameters, Secrets } from 'utils';
import { ZambdaInput } from '../../../shared';
import { getStripeCustomerId } from '../helpers';

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodDeleteParameters & { secrets: Secrets | null } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { beneficiaryPatientId, paymentMethodId } = JSON.parse(input.body);

  if (!beneficiaryPatientId) {
    throw new Error('beneficiaryPatientId is not defined');
  }

  if (!paymentMethodId) {
    throw new Error('paymentMethodId is not defined');
  }

  return {
    beneficiaryPatientId,
    paymentMethodId,
    secrets: input.secrets,
  };
}

interface ComplexValidationInput {
  patientId: string;
  oystehrClient: Oystehr;
}
export async function complexValidation(input: ComplexValidationInput): Promise<{ stripeCustomerId: string }> {
  return getStripeCustomerId(input);
}
