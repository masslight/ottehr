import { AssignPractitionerInput } from 'utils';
import { getSecret, SecretsKeys, ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): AssignPractitionerInput & { userToken: string } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId, practitioner, userRole } = JSON.parse(input.body);

  if (encounterId === undefined || practitioner === undefined || userRole === undefined) {
    throw new Error('These fields are required: "encounterId" "practitioner" "userRole".');
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
    practitioner,
    userRole,
    secrets: input.secrets,
    userToken,
  };
}
