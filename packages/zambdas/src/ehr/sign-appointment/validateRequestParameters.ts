import { getSecret, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS, SecretsKeys, SignAppointmentInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): SignAppointmentInput & { userToken: string } {
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

  const { appointmentId, timezone } = body;

  if (appointmentId === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['appointmentId']);
  } else if (typeof appointmentId !== 'string') {
    throw INVALID_INPUT_ERROR(
      `Invalid "appointmentId" parameter provided: ${JSON.stringify(appointmentId)}. It must be a string.`
    );
  }

  if (getSecret(SecretsKeys.PROJECT_API, input.secrets) === undefined) {
    throw new Error('"PROJECT_API" configuration not provided');
  }

  if (getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets) === undefined) {
    throw new Error('"ORGANIZATION_ID" configuration not provided');
  }

  if (timezone != undefined && typeof timezone !== 'string') {
    throw INVALID_INPUT_ERROR(
      `Invalid "timezone" parameter provided: ${JSON.stringify(timezone)}. It must be a string or null.`
    );
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!input.secrets) {
    throw new Error('Secrets are required for this operation');
  }

  const supervisorApprovalEnabled =
    typeof body.supervisorApprovalEnabled === 'boolean' ? body.supervisorApprovalEnabled : false;

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentId,
    secrets: input.secrets,
    timezone: timezone ?? null,
    userToken,
    supervisorApprovalEnabled,
  };
}
