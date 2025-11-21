import {
  ChangeTelemedAppointmentStatusInput,
  getSecret,
  SecretsKeys,
  TelemedAppointmentStatus,
  TelemedCallStatusesArr,
} from 'utils';
import { ZambdaInput } from '../../shared/types';

function isTelemedAppointmentStatus(value: unknown): value is TelemedAppointmentStatus {
  return typeof value === 'string' && TelemedCallStatusesArr.includes(value as TelemedAppointmentStatus);
}

export function validateRequestParameters(
  input: ZambdaInput
): ChangeTelemedAppointmentStatusInput & { userToken: string } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body');
  }

  if (!parsedBody || typeof parsedBody !== 'object') {
    throw new Error('Request body must be a valid JSON object');
  }

  const body = parsedBody as Record<string, unknown>;

  const { appointmentId, newStatus } = body;

  if (typeof appointmentId !== 'string') {
    throw new Error('These fields are required: "appointmentId".');
  }
  if (typeof newStatus !== 'string') {
    throw new Error('These fields are required: "newStatus".');
  }

  if (!isTelemedAppointmentStatus(newStatus)) {
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
