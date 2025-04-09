import { Control, UseFormGetValues, UseFormSetValue } from 'react-hook-form';
import { User, PractitionerLicense } from 'utils';

export interface FormErrors {
  submit: boolean;
  roles: boolean;
  qualification: boolean;
  state: boolean;
  duplicateLicense: boolean;
  npi: boolean;
  phoneNumber: boolean;
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
  roles: string[];
  phoneNumber: string;
  npi: string;
  newLicenseState?: string;
  newLicenseCode?: string;
}

export interface ProviderDetailsProps {
  control: Control<any>;
  photoSrc: string;
  errors: FormErrors;
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
}
