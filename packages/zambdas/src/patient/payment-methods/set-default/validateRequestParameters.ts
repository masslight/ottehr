import {
  FHIR_RESOURCE_NOT_FOUND,
  getStripeCustomerIdFromAccount,
  PaymentMethodSetDefaultParameters,
  Secrets,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils';
import { ZambdaInput } from '../../../shared';
import Oystehr from '@oystehr/sdk';
import { getBillingAccountForPatient } from '../helpers';

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodSetDefaultParameters & { secrets: Secrets | null } {
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
  const { patientId, oystehrClient } = input;

  const patientAccount = await getBillingAccountForPatient(patientId, oystehrClient);
  if (!patientAccount) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }
  const stripeCustomerId = getStripeCustomerIdFromAccount(patientAccount);
  if (!stripeCustomerId) {
    throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
  }
  return { stripeCustomerId };
}
