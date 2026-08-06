import Oystehr from '@oystehr/sdk';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { PaymentMethodDeleteParameters } from 'utils/lib/types/data/payment/payment-method-types';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { getStripeCustomerId } from '../helpers';

const PaymentMethodDeleteBodySchema = z.object({
  beneficiaryPatientId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodDeleteParameters & { secrets: Secrets | null } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { beneficiaryPatientId, paymentMethodId, appointmentId } = safeValidate(
    PaymentMethodDeleteBodySchema,
    safeJsonParse(input.body)
  );

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
