import { EmployeeDetails } from 'utils';

export const PROVIDERS_FILTER = (employee: EmployeeDetails): boolean => {
  return employee.isProvider && !employee.isCustomerSupport;
};
