import { PractitionerLicense } from '../../../main';

import { RoleType } from '../../../main';

export interface UpdateUserParams {
  userId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nameSuffix?: string;
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
