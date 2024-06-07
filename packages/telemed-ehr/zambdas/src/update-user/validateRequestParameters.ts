import { UpdateUserInput } from '.';
import { RoleType } from '../../../app/src/types/types';
import { ZambdaInput } from '../types';

export function validateRequestParameters(input: ZambdaInput): UpdateUserInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { userId, firstName, middleName, lastName, nameSuffix, selectedRoles, licenses } = JSON.parse(input.body);

  if (
    userId === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "userId"');
  }

  if (selectedRoles) {
    for (const role of selectedRoles) {
      if (!Object.keys(RoleType).includes(role))
        throw new Error(
          `Invalid roles selected. Role must be one of "${Object.keys(RoleType).join('", "')}". Received "${role}"`
        );
    }
  }

  return {
    userId,
    firstName: firstName ? firstName.trim() : firstName,
    middleName: middleName ? middleName.trim() : middleName,
    lastName: lastName ? lastName.trim() : lastName,
    nameSuffix: nameSuffix ? nameSuffix.trim() : nameSuffix,
    selectedRoles,
    licenses,
    // locations,
    secrets: input.secrets,
  };
}
