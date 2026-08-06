import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { PaymentMethodSetupParameters } from 'utils/lib/types/data/payment/payment-method-types';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const PaymentMethodSetupBodySchema = z.object({
  beneficiaryPatientId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodSetupParameters & { secrets: Secrets | null } & { authorization: any } {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { beneficiaryPatientId, appointmentId } = safeValidate(PaymentMethodSetupBodySchema, safeJsonParse(input.body));

  return {
    beneficiaryPatientId,
    appointmentId,
    secrets: input.secrets,
    authorization,
  };
}
