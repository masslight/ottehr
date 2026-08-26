import { EmployeeDetails, isCustomerSupport, isProvider } from 'utils/lib/types/api/get-employees/get-employees.types';

export const PROVIDERS_FILTER = (employee: EmployeeDetails): boolean => {
  return isProvider(employee) && !isCustomerSupport(employee);
};
