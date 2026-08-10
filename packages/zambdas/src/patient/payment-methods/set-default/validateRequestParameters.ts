import Oystehr from '@oystehr/sdk';
import { Secrets } from 'utils/lib/secrets';
import { PaymentMethodSetDefaultParameters } from 'utils/lib/types/data/payment/payment-method-types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
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
    safeJsonParse(input.body)
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
