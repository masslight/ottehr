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

/** Anything carrying role names. Widened from `EmployeeDetails` because role names arrive from
 *  Oystehr as plain strings — a project may define roles beyond {@link RoleType} — so callers that
 *  read roles off a user rather than an employee record need not cast. */
export interface HasRoles {
  roles: readonly string[];
}

/** True when the user holds the Provider role. Providers are employees; there is no separate list. */
export const isProvider = (employee: HasRoles): boolean => employee.roles.includes(RoleType.Provider);

export const isCustomerSupport = (employee: HasRoles): boolean => employee.roles.includes(RoleType.CustomerSupport);

/** True when the user has been deactivated. Deactivation *adds* the Inactive role, leaving the
 *  employee's other roles (including Provider) in place — so a role check alone still sees them as
 *  a provider. See the user-activation zambda. */
export const isInactive = (employee: HasRoles): boolean => employee.roles.includes(RoleType.Inactive);

/**
 * True when these roles allow the employee to hold a visit's Provider assignment (the encounter's
 * Attender).
 *
 * This is the roles-only form of the provider roster the EHR's assignment dropdown is built from
 * (see useGetEmployees): the dropdown additionally filters on `status`, which is itself derived from
 * Inactive membership, so the two agree. Use this where the roster isn't available — notably the
 * backend, which sees roles but not the assembled employee list.
 */
export const canBeAssignedAsProvider = (employee: HasRoles): boolean =>
  isProvider(employee) && !isCustomerSupport(employee) && !isInactive(employee);

export interface GetEmployeesResponse {
  message: string;
  employees: EmployeeDetails[];
}
