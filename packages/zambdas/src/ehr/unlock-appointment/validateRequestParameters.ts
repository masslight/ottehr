import { getSecret, SecretsKeys, UnlockAppointmentZambdaInputValidated } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const UnlockAppointmentBodySchema = z.object({
  appointmentId: z.string(),
});

export function validateRequestParameters(input: ZambdaInput): UnlockAppointmentZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId } = safeValidate(UnlockAppointmentBodySchema, JSON.parse(input.body));

  if (!input.secrets) {
    throw new Error('No secrets provided');
  }

  getSecret(SecretsKeys.PROJECT_API, input.secrets);
  getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return {
    appointmentId,
    secrets: input.secrets,
    userToken,
  };
}
