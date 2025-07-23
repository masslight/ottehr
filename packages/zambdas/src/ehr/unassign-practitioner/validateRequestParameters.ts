import { getSecret, SecretsKeys } from 'utils';
import { ZambdaInput } from '../../shared';
import { UnassignPractitionerZambdaInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): UnassignPractitionerZambdaInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId, practitionerId, userRole } = JSON.parse(input.body);

  if (encounterId === undefined || practitionerId === undefined || userRole === undefined) {
    throw new Error('These fields are required: "encounterId" "practitionerId" "userRole".');
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
    encounterId,
    practitionerId,
    userRole,
    secrets: input.secrets,
    userToken,
  };
}
