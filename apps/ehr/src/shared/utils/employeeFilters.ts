import { EmployeeDetails } from 'utils/lib/types/api/get-employees/get-employees.types';

export const PROVIDERS_FILTER = (employee: EmployeeDetails): boolean => {
  return employee.isProvider && !employee.isCustomerSupport;
};
