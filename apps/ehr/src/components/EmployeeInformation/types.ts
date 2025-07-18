import { DateTime } from 'luxon';
import { Control, UseFormGetValues, UseFormSetValue } from 'react-hook-form';
import { PractitionerLicense, RoleType, User } from 'utils';

export interface FormErrors {
  submit: boolean;
  roles: boolean;
  qualification: boolean;
  state: boolean;
  number: boolean;
  date: boolean;
  duplicateLicense: boolean;
}

export interface EditEmployeeInformationProps {
  submitLabel: string;
  existingUser: User;
  isActive: boolean | undefined;
  licenses: PractitionerLicense[];
  getUserAndUpdatePage: () => Promise<void>;
}

export interface EmployeeForm {
  firstName: string;
  middleName: string;
  lastName: string;
  nameSuffix: string;
  roles: RoleType[];
  phoneNumber: string;
  birthDate: DateTime;
  faxNumber: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  npi: string;
  newLicenseState?: string;
  newLicenseCode?: string;
  newLicenseNumber?: string;
  newLicenseExpirationDate?: DateTime;
}

export interface ProviderDetailsProps {
  control: Control<any>;
  photoSrc: string;
  roles: string[];
}

export interface RoleSelectionProps {
  control: Control<any>;
  errors: FormErrors;
  isActive: boolean;
  getValues: UseFormGetValues<any>;
  setValue: UseFormSetValue<any>;
}

export interface BasicInformationProps {
  control: Control<any>;
  existingUser?: User;
  errors: FormErrors;
  isActive?: boolean;
}
