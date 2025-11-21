import { getSecret, SecretsKeys, UnlockAppointmentZambdaInputValidated } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): UnlockAppointmentZambdaInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId } = JSON.parse(input.body);

  if (appointmentId === undefined) {
    throw new Error('These fields are required: "appointmentId".');
  }

  if (getSecret(SecretsKeys.PROJECT_API, input.secrets) === undefined) {
    throw new Error('"PROJECT_API" configuration not provided');
  }

  if (getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
    throw new Error('"ORGANIZATION_ID" configuration not provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!input.secrets) {
    throw new Error('No secrets provided');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentId,
    secrets: input.secrets,
    userToken,
  };
}
