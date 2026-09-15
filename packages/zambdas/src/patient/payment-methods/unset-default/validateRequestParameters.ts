import Oystehr from '@oystehr/sdk';
import { Secrets } from 'utils/lib/secrets';
import { PaymentMethodUnsetDefaultParameters } from 'utils/lib/types/data/payment/payment-method-types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { getStripeCustomerId } from '../helpers';

const PaymentMethodUnsetDefaultBodySchema = z.object({
  beneficiaryPatientId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodUnsetDefaultParameters & { secrets: Secrets | null } {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { beneficiaryPatientId, appointmentId } = safeValidate(
    PaymentMethodUnsetDefaultBodySchema,
    safeJsonParse(input.body)
  );

  return {
    beneficiaryPatientId,
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
