import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { UnlockAppointmentZambdaInputValidated } from 'utils/lib/types/api/unlock-appointment/unlock-appointment.types';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeValidate } from '../../shared/validation';

const UnlockAppointmentBodySchema = z
  .object({
    appointmentId: z.string().uuid().optional(),
    encounterId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.appointmentId) !== Boolean(data.encounterId), {
    message: 'Provide exactly one of appointmentId or encounterId',
  });

export function validateRequestParameters(input: ZambdaInput): UnlockAppointmentZambdaInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { appointmentId, encounterId } = safeValidate(UnlockAppointmentBodySchema, JSON.parse(input.body));

  getSecret(SecretsKeys.PROJECT_API, input.secrets);
  getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    appointmentId,
    encounterId,
    secrets: input.secrets,
    userToken,
  };
}
