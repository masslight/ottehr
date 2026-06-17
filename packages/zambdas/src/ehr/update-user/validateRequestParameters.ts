import {
  isNPIValid,
  isPhoneNumberValid,
  isProviderTypeCode,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PROVIDER_TYPE_VALUES,
  RoleType,
  Secrets,
  UpdateUserParams,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const UpdateUserSchema = z
  .object({
    userId: z.string().uuid(),
    firstName: z.string().optional(),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    providerType: z.string().optional(),
    providerTypeText: z.string().optional(),
    selectedRoles: z.array(z.nativeEnum(RoleType)).min(1, 'At least one role must be selected.').optional(),
    licenses: z.array(z.any()).optional(),
    phoneNumber: z.string().optional(),
    npi: z.string().optional(),
    birthDate: z.string().optional(),
    faxNumber: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    addressCity: z.string().optional(),
    addressState: z.string().optional(),
    addressZip: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.phoneNumber && !isPhoneNumberValid(data.phoneNumber)) {
        return false;
      }
      return true;
    },
    { message: 'Invalid phone number' }
  )
  .refine(
    (data) => {
      if (data.selectedRoles?.includes(RoleType.Provider) && data.npi && !isNPIValid(data.npi)) {
        return false;
      }
      return true;
    },
    { message: 'Invalid NPI format' }
  )
  .refine(
    (data) => {
      if (data.providerType && !isProviderTypeCode(data.providerType)) {
        return false;
      }
      return true;
    },
    {
      message: `Invalid providerType. Must be one of "${PROVIDER_TYPE_VALUES.join('", "')}"`,
    }
  )
  .refine(
    (data) => {
      if (data.providerType === 'other' && (!data.providerTypeText || !data.providerTypeText.trim())) {
        return false;
      }
      return true;
    },
    { message: 'providerTypeText is required when providerType is "other"' }
  );

export function validateRequestParameters(input: ZambdaInput): UpdateUserParams & { secrets: Secrets } {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = safeJsonParse(input.body);

  const validated = safeValidate(UpdateUserSchema, parsedJSON);

  return {
    userId: validated.userId,
    firstName: validated.firstName ? validated.firstName.trim() : validated.firstName,
    middleName: validated.middleName ? validated.middleName.trim() : validated.middleName,
    lastName: validated.lastName ? validated.lastName.trim() : validated.lastName,
    providerType: validated.providerType as UpdateUserParams['providerType'],
    providerTypeText: validated.providerTypeText ? validated.providerTypeText.trim() : validated.providerTypeText,
    selectedRoles: validated.selectedRoles,
    licenses: validated.licenses,
    phoneNumber: validated.phoneNumber ? validated.phoneNumber.trim() : validated.phoneNumber,
    npi: validated.npi ? validated.npi.trim() : validated.npi,
    secrets: input.secrets,
    birthDate: validated.birthDate ? validated.birthDate.trim() : validated.birthDate,
    faxNumber: validated.faxNumber ? validated.faxNumber.trim() : validated.faxNumber,
    addressLine1: validated.addressLine1 ? validated.addressLine1.trim() : validated.addressLine1,
    addressLine2: validated.addressLine2 ? validated.addressLine2.trim() : validated.addressLine2,
    addressCity: validated.addressCity ? validated.addressCity.trim() : validated.addressCity,
    addressState: validated.addressState ? validated.addressState.trim() : validated.addressState,
    addressZip: validated.addressZip ? validated.addressZip.trim() : validated.addressZip,
  };
}
