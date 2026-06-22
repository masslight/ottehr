import {
  getSecret,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SecretsKeys,
  UnlockAppointmentZambdaInputValidated,
} from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const UnlockAppointmentBodySchema = z
  .object({
    appointmentId: z.string().uuid().optional(),
    encounterId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.appointmentId || data.encounterId), {
    message: 'Either appointmentId or encounterId is required',
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
