import Oystehr from '@oystehr/sdk';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED, PaymentMethodSetDefaultParameters, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';
import { getStripeCustomerId } from '../helpers';

const PaymentMethodSetDefaultBodySchema = z.object({
  beneficiaryPatientId: z.string().uuid(),
  paymentMethodId: z.string().min(1),
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodSetDefaultParameters & { secrets: Secrets | null } {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { beneficiaryPatientId, paymentMethodId, appointmentId } = safeValidate(
    PaymentMethodSetDefaultBodySchema,
    JSON.parse(input.body)
  );

  return {
    beneficiaryPatientId,
    appointmentId,
    paymentMethodId,
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
