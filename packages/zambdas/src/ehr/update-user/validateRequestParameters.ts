import {
  isNPIValid,
  isPhoneNumberValid,
  isProviderTypeCode,
  PROVIDER_TYPE_VALUES,
  RoleType,
  Secrets,
  UpdateUserParams,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): UpdateUserParams & { secrets: Secrets } {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    userId,
    firstName,
    middleName,
    lastName,
    providerType,
    providerTypeText,
    selectedRoles,
    licenses,
    phoneNumber,
    npi,
    birthDate,
    faxNumber,
    addressLine1,
    addressLine2,
    addressCity,
    addressState,
    addressZip,
  } = JSON.parse(input.body) as UpdateUserParams;

  if (
    userId === undefined
    // locations === undefined ||
    // locations.length === 0
  ) {
    throw new Error('These fields are required: "userId"');
  }

  if (phoneNumber && !isPhoneNumberValid(phoneNumber)) {
    throw new Error('Invalid phone number');
  }

  if (selectedRoles?.includes(RoleType.Provider) && npi && !isNPIValid(npi)) {
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

  if (providerType) {
    if (!isProviderTypeCode(providerType)) {
      throw new Error(
        `Invalid providerType. Must be one of "${PROVIDER_TYPE_VALUES.join('", "')}". Received "${providerType}"`
      );
    }

    if (providerType === 'other' && (!providerTypeText || !providerTypeText.trim())) {
      throw new Error('providerTypeText is required when providerType is "other"');
    }
  }

  return {
    userId,
    firstName: firstName ? firstName.trim() : firstName,
    middleName: middleName ? middleName.trim() : middleName,
    lastName: lastName ? lastName.trim() : lastName,
    providerType,
    providerTypeText: providerTypeText ? providerTypeText.trim() : providerTypeText,
    selectedRoles,
    licenses,
    // locations,
    phoneNumber: phoneNumber ? phoneNumber.trim() : phoneNumber,
    npi: npi ? npi.trim() : npi,
    secrets: input.secrets!,
    birthDate: birthDate ? birthDate.trim() : birthDate,
    faxNumber: faxNumber ? faxNumber.trim() : faxNumber,
    addressLine1: addressLine1 ? addressLine1.trim() : addressLine1,
    addressLine2: addressLine2 ? addressLine2.trim() : addressLine2,
    addressCity: addressCity ? addressCity.trim() : addressCity,
    addressState: addressState ? addressState.trim() : addressState,
    addressZip: addressZip ? addressZip.trim() : addressZip,
  };
}
