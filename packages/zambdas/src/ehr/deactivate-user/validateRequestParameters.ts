import { ZambdaInput } from '../../shared';
import { DeactivateUserZambdaInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): DeactivateUserZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  let parsedBody: any;
  try {
    parsedBody = JSON.parse(input.body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }

  if (!parsedBody || typeof parsedBody !== 'object') {
    throw new Error('Request body must be a valid JSON object');
  }

  const { user } = parsedBody;

  if (user == null) {
    throw new Error('This field is required: "user"');
  }

  if (typeof user !== 'object') {
    throw new Error('User must be a valid object');
  }

  // Validate that user has required properties for a User object
  if (typeof user.id !== 'string') {
    throw new Error('User must have a valid id');
  }

  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  return {
    user,
    secrets: input.secrets,
  };
}
