import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { ProviderDetails } from 'utils';
import { getEmployees } from '../../../../api/api';
import { useApiClients } from '../../../../hooks/useAppClients';

export interface EmployeesForAssignment {
  /** Active employees flagged as providers — used to populate the "Provider" assignment list. */
  providers: ProviderDetails[];
  /** Active, non-customer-support employees — used to populate the "Intake" assignment list. */
  nonProviders: ProviderDetails[];
}

const toProviderDetails = (employee: { profile: string; firstName: string; lastName: string }): ProviderDetails => ({
  practitionerId: employee.profile.split('/')[1],
  name: `${employee.firstName} ${employee.lastName}`.trim(),
});

/**
 * Fetches the intake-staff and provider lists used for assigning practitioners to an encounter.
 *
 * Shared by the chart header and the tracking board so both surfaces display the exact same lists.
 * Uses a stable query key + long stale time so the (rarely-changing) employee list is fetched once
 * and reused across navigations and across every tracking-board row.
 */
export const useGetEmployees = (options?: {
  enabled?: boolean;
}): UseQueryResult<EmployeesForAssignment | null, Error> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['progress-note-header-employees'],
    queryFn: async () => {
      if (!oystehrZambda) return null;
      const getEmployeesRes = await getEmployees(oystehrZambda, { lite: true });
      const activeEmployees = getEmployeesRes.employees.filter((employee) => employee.status === 'Active');

      const formattedProviders: ProviderDetails[] = activeEmployees
        .filter((employee) => employee.isProvider && !employee.isCustomerSupport)
        .map(toProviderDetails)
        .filter((prov) => prov.name);

      // TODO: remove this once we have nurses role
      // const nonProviders = getEmployeesRes.employees.filter((employee) => !employee.isProvider);
      const formattedNonProviders: ProviderDetails[] = activeEmployees
        .filter((employee) => !employee.isCustomerSupport)
        .map(toProviderDetails)
        .filter((prov) => prov.name);

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
