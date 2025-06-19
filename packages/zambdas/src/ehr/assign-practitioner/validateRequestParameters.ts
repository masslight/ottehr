import { Practitioner, Coding } from 'fhir/r4b';
import { AssignPractitionerInputValidated, getSecret, SecretsKeys } from 'utils';
import { ZambdaInput } from '../../shared/types';

export function validateRequestParameters(input: ZambdaInput): AssignPractitionerInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedJSON = JSON.parse(input.body) as unknown;

  // Safely extract and validate encounterId
  if (!parsedJSON || typeof parsedJSON !== 'object') {
    throw new Error('Request body must be a valid JSON object');
  }

  const body = parsedJSON as Record<string, unknown>;

  if (typeof body.encounterId !== 'string') {
    throw new Error('encounterId must be a string');
  }

  const encounterId = body.encounterId;

  // Validate practitioner - check for required Practitioner properties
  if (!body.practitioner || typeof body.practitioner !== 'object') {
    throw new Error('practitioner must be a valid Practitioner object');
  }

  const practitionerObj = body.practitioner as Record<string, unknown>;
  if (practitionerObj.resourceType !== 'Practitioner') {
    throw new Error('practitioner must have resourceType "Practitioner"');
  }

  const practitioner = body.practitioner as Practitioner;

  // Validate userRole - should be an array of Coding objects
  if (!Array.isArray(body.userRole)) {
    throw new Error('userRole must be an array of Coding objects');
  }

  const userRole = body.userRole as unknown[];

  // Validate each item in userRole array is a valid Coding object
  for (let i = 0; i < userRole.length; i++) {
    const coding = userRole[i];
    if (!coding || typeof coding !== 'object') {
      throw new Error(`userRole[${i}] must be a valid Coding object`);
    }

    const codingObj = coding as Record<string, unknown>;
    if (codingObj.code != undefined && typeof codingObj.code !== 'string') {
      throw new Error(`userRole[${i}].code must be a string if provided`);
    }

    if (codingObj.display !== undefined && typeof codingObj.display !== 'string') {
      throw new Error(`userRole[${i}].display must be a string if provided`);
    }

    if (codingObj.system !== undefined && typeof codingObj.system !== 'string') {
      throw new Error(`userRole[${i}].system must be a string if provided`);
    }
  }

  const validatedUserRole = userRole as Coding[];

  if (encounterId === undefined || practitioner === undefined || validatedUserRole === undefined) {
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
    userRole: validatedUserRole,
    secrets: input.secrets,
    userToken,
  };
}
