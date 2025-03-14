import { ChangeTelemedAppointmentStatusInput, TelemedCallStatusesArr } from 'utils';
import { getSecret, SecretsKeys, ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(
  input: ZambdaInput
): ChangeTelemedAppointmentStatusInput & { userToken: string } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, newStatus } = JSON.parse(input.body);

  if (appointmentId === undefined) {
    throw new Error('These fields are required: "appointmentId".');
  }
  if (newStatus === undefined) {
    throw new Error('These fields are required: "newStatus".');
  }

  // is it a good way to validate if string fit in typescirpt type??
  if (!TelemedCallStatusesArr.includes(newStatus)) {
    throw new Error('"newStatus" field value is not TelemedCallStatuses type.');
  }

  if (getSecret(SecretsKeys.PROJECT_API, input.secrets) === undefined) {
    throw new Error('"PROJECT_API" configuration not provided');
  }

  if (getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
    throw new Error('"ORGANIZATION_ID" configuration not provided');
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentId,
    newStatus,
    secrets: input.secrets,
    userToken,
  };
}
