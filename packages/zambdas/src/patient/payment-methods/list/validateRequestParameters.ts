import { MISSING_REQUEST_BODY, NOT_AUTHORIZED, PaymentMethodListParameters, Secrets } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../../shared';

const PaymentMethodListBodySchema = z.object({
  beneficiaryPatientId: z.string().uuid(),
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): PaymentMethodListParameters & { secrets: Secrets | null } & { authorization: any } {
  const authorization = input.headers.Authorization;
  if (!authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { beneficiaryPatientId, appointmentId } = safeValidate(PaymentMethodListBodySchema, safeJsonParse(input.body));

  return {
    beneficiaryPatientId,
    appointmentId,
    secrets: input.secrets,
    authorization,
  };
}
