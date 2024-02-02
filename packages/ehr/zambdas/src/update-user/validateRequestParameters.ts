import { ZambdaInput } from '../types';
//import { RoleType } from '../../../app/src/types/types';
import { RoleType } from '../shared/rolesUtils';
import { UpdateUserInput } from '.';

export function validateRequestParameters(input: ZambdaInput): UpdateUserInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { userId, selectedRole } = JSON.parse(input.body);

  if (
    userId === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "userId"');
  }

  if (
    selectedRole &&
    selectedRole !== RoleType.Manager &&
    selectedRole !== RoleType.FrontDesk &&
    selectedRole !== RoleType.Provider &&
    selectedRole !== RoleType.Administrator &&
    selectedRole !== RoleType.Staff
  ) {
    throw new Error(
      `Invalid role selected. Role must be one of "${RoleType.Manager}", "${RoleType.FrontDesk}", "${RoleType.Provider}", "${RoleType.Staff}"`,
    );
  }

  return {
    userId,
    selectedRole,
    // locations,
    secrets: input.secrets,
  };
}
