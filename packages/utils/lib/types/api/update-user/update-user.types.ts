import { PractitionerLicense, ProviderTypeCode } from '../practitioner.types';
import { RoleType } from '../user.types';

export interface UpdateUserParams {
  userId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  providerType?: ProviderTypeCode;
  providerTypeText?: string;
  selectedRoles?: RoleType[];
  licenses?: PractitionerLicense[];
  phoneNumber?: string;
  npi?: string;
  birthDate?: string;
  faxNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

export interface UpdateUserZambdaOutput {
  message: string;
}
