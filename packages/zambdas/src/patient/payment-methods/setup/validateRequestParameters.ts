import { MISSING_REQUEST_BODY, NOT_AUTHORIZED, PaymentMethodSetupParameters, Secrets } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

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

  const { beneficiaryPatientId, appointmentId } = safeValidate(PaymentMethodSetupBodySchema, JSON.parse(input.body));

  return {
    beneficiaryPatientId,
    appointmentId,
    secrets: input.secrets,
    authorization,
  };
}
