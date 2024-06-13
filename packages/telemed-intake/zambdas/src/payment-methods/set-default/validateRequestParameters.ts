import { PaymentMethodSetDefaultParameters, Secrets, ZambdaInput } from 'ottehr-utils';

export function validateRequestParameters(
  input: ZambdaInput,
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
