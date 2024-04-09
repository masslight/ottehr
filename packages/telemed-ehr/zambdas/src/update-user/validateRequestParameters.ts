import { ZambdaInput } from '../types';
import { RoleType } from '../../../app/src/types/types';
import { UpdateUserInput } from '.';

export function validateRequestParameters(input: ZambdaInput): UpdateUserInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { userId, selectedRole, licenses } = JSON.parse(input.body);

  if (
    userId === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "userId"');
  }

  if (
    selectedRole &&
    selectedRole !== RoleType.Administrator &&
    selectedRole !== RoleType.Manager &&
    selectedRole !== RoleType.Provider &&
    selectedRole !== RoleType.Staff
  ) {
    throw new Error(
      `Invalid role selected. Role must be one of "${RoleType.Administrator}", "${RoleType.Manager}", "${RoleType.Provider}", "${RoleType.Staff}"`,
    );
  }

  return {
    userId,
    selectedRole,
    licenses,
    // locations,
    secrets: input.secrets,
  };
}
