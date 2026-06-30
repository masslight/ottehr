import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { EmployeeDetails, ProviderDetails } from 'utils';
import { getEmployees } from '../../../../api/api';
import { useApiClients } from '../../../../hooks/useAppClients';

export interface EmployeesForAssignment {
  /** Active employees flagged as providers — used to populate the "Provider" assignment list. */
  providers: ProviderDetails[];
  /** Active, non-customer-support employees — used to populate the "Intake" assignment list. */
  nonProviders: ProviderDetails[];
}

export const toProviderDetails = (employee: {
  profile: string;
  firstName: string;
  lastName: string;
  /** Canonical employee display name. Used as a fallback when firstName +
   *  lastName don't produce a usable label (e.g. Practitioner records where
   *  only the legacy single-string name is populated). The upstream filter
   *  in useGetEmployeesWithDetails already drops entries whose `name` is
   *  blank, so this fallback always has something to land on for surviving
   *  entries — no risk of producing a blank ProviderDetails.name. */
  name?: string;
}): ProviderDetails => {
  const composedName = `${employee.firstName} ${employee.lastName}`.trim();
  return {
    practitionerId: employee.profile.split('/')[1],
    name: composedName || employee.name || '',
  };
};

/**
 * Fetches the intake-staff and provider lists used for assigning practitioners to an encounter.
 *
 * Shared by the chart header and the tracking board so both surfaces display the exact same lists.
 * Uses a stable query key + long stale time so the (rarely-changing) employee list is fetched once
 * and reused across navigations and across every tracking-board row.
 */
export const useGetEmployees = (options?: {
  enabled?: boolean;
}): Pick<UseQueryResult<EmployeesForAssignment | null, Error>, 'data' | 'isLoading' | 'isError' | 'error'> => {
  const res = useGetEmployeesWithDetails({ enabled: options?.enabled ?? true });
  const { data } = res;

  const newData =
    data == null
      ? data
      : {
          providers: data.providers.map(toProviderDetails),
          nonProviders: data.nonProviders.map(toProviderDetails),
        };

  return { ...res, data: newData };
};

export const useGetEmployeesWithDetails = (options?: {
  enabled?: boolean;
}): UseQueryResult<{ providers: EmployeeDetails[]; nonProviders: EmployeeDetails[] } | null, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['progress-note-header-employees'],
    queryFn: async () => {
      if (!oystehrZambda) return null;
      const getEmployeesRes = await getEmployees(oystehrZambda, { lite: true });
      const activeEmployees = getEmployeesRes.employees.filter((employee) => employee.status === 'Active');

      const formattedProviders: EmployeeDetails[] = activeEmployees
        .filter((employee) => employee.isProvider && !employee.isCustomerSupport)
        .filter((employee) => Boolean(`${employee.firstName} ${employee.lastName}`.trim() || employee.name));

      // TODO: remove this once we have nurses role
      // const nonProviders = getEmployeesRes.employees.filter((employee) => !employee.isProvider);
      const formattedNonProviders: EmployeeDetails[] = activeEmployees
        .filter((employee) => !employee.isCustomerSupport)
        .filter((employee) => Boolean(`${employee.firstName} ${employee.lastName}`.trim() || employee.name));

      return {
        providers: formattedProviders,
        nonProviders: formattedNonProviders,
      };
    },
    enabled: !!oystehrZambda && (options?.enabled ?? true),
    // Employees rarely change — cache across navigations to keep the UI fast.
    staleTime: 5 * 60 * 1000,
  });
};
