import { isNPIValid, RoleType, isPhoneNumberValid } from 'utils';
import { UpdateUserInput } from '.';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): UpdateUserInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { userId, firstName, middleName, lastName, nameSuffix, selectedRoles, licenses, phoneNumber, npi } = JSON.parse(
    input.body
  );

  if (
    userId === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "userId"');
  }

  if (phoneNumber && !isPhoneNumberValid(phoneNumber)) {
    throw new Error('Invalid phone number format');
  }

  if (npi && !isNPIValid(npi)) {
    throw new Error('Invalid NPI format');
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
    phoneNumber: phoneNumber ? phoneNumber.trim() : phoneNumber,
    npi: npi ? npi.trim() : npi,
  };
}
