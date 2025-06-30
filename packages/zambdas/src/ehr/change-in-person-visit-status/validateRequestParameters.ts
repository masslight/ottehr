import { getSecret, SecretsKeys, User, Visit_Status_Array, VisitStatusWithoutUnknown } from 'utils';
import { ZambdaInput } from '../../shared/types';
import { ChangeInPersonVisitStatusInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): ChangeInPersonVisitStatusInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedBody = JSON.parse(input.body) as unknown;

  // Safely unwrap and validate encounterId
  if (typeof parsedBody !== 'object' || parsedBody === null) {
    throw new Error('Request body must be a valid JSON object');
  }

  const bodyObj = parsedBody as Record<string, unknown>;

  const { encounterId, user, updatedStatus } = bodyObj;

  // Type-safe validation for encounterId
  if (typeof encounterId !== 'string') {
    throw new Error('Field "encounterId" is required and must be a string');
  }

  // Type-safe validation for user
  if (typeof user !== 'object' || user === null) {
    throw new Error('Field "user" is required and must be an object');
  }

  // Validate user has required properties
  const userObj = user as Record<string, unknown>;
  if (typeof userObj.id !== 'string' || typeof userObj.name !== 'string') {
    throw new Error('Field "user" must have valid "id" and "name" properties');
  }

  // Type-safe validation for updatedStatus
  if (typeof updatedStatus !== 'string') {
    throw new Error('Field "updatedStatus" is required and must be a string');
  }

  // Validate updatedStatus is a valid VisitStatusWithoutUnknown
  // Derive valid statuses from the Visit_Status_Array, excluding 'unknown'
  const validStatuses = Visit_Status_Array.filter((status) => status !== 'unknown') as VisitStatusWithoutUnknown[];

  if (!validStatuses.includes(updatedStatus as VisitStatusWithoutUnknown)) {
    throw new Error(`Field "updatedStatus" must be one of: ${validStatuses.join(', ')}`);
  }

  const typeSafeSecrets = input.secrets;

  if (typeSafeSecrets == null) {
    throw new Error('No secrets provided');
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
    encounterId,
    user: user as User,
    updatedStatus: updatedStatus as VisitStatusWithoutUnknown,
    secrets: typeSafeSecrets,
    userToken,
  };
}
