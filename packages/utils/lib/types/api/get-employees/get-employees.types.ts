import { PractitionerLicense } from '../practitioner.types';

export interface EmployeeDetails {
  id: string;
  profile: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: 'Active' | 'Deactivated';
  lastLogin?: string;
  licenses: PractitionerLicense[];
  seenPatientRecently: boolean;
  gettingAlerts: boolean;
  isProvider: boolean;
  isCustomerSupport: boolean;
}

export interface GetEmployeesResponse {
  message: string;
  employees: EmployeeDetails[];
}
