import { PractitionerLicense } from '../practitioner.types';
import { RoleType } from '../user.types';

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
  /**
   * Every assignable role the user holds. `Inactive` is deliberately absent — it is reported as
   * `status`, not as a role, so callers can't end up with a user who is both 'Active' and Inactive.
   */
  roles: RoleType[];
  needsReview?: boolean;
}

/** True when the user holds the Provider role. Providers are employees; there is no separate list. */
export const isProvider = (employee: Pick<EmployeeDetails, 'roles'>): boolean =>
  employee.roles.includes(RoleType.Provider);

export const isCustomerSupport = (employee: Pick<EmployeeDetails, 'roles'>): boolean =>
  employee.roles.includes(RoleType.CustomerSupport);

export interface GetEmployeesResponse {
  message: string;
  employees: EmployeeDetails[];
}
