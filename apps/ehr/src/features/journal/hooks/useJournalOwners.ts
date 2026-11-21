import { useMemo } from 'react';
import { toProviderDetails, useGetEmployeesWithDetails } from 'src/features/visits/shared/hooks/useGetEmployees';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { ProviderDetails } from 'utils/lib/types/api/encounter.types';
import { isCustomerSupport } from 'utils/lib/types/api/get-employees/get-employees.types';
import { RoleType } from 'utils/lib/types/api/user.types';

/**
 * Active Providers and Clinicians (the people who have a journal), with the signed-in user's practitioner id and
 * whether they are on the Provider picker's list (who can take over a colleague's visit). Like that list, it leaves
 * out Customer Support users, who can still open anyone's journal.
 */
export const useJournalOwners = (): {
  owners: ProviderDetails[];
  myPractitionerId?: string;
  iAmProvider: boolean;
  isLoading: boolean;
} => {
  const { data, isLoading } = useGetEmployeesWithDetails();
  const user = useEvolveUser();
  const myPractitionerId = user?.profile?.split('/')[1];

  const owners = useMemo(
    () =>
      (data?.all ?? [])
        .filter(
          (employee) =>
            employee.status === 'Active' &&
            !isCustomerSupport(employee) &&
            (employee.roles.includes(RoleType.Provider) || employee.roles.includes(RoleType.Clinician))
        )
        .map(toProviderDetails)
        .filter((owner) => owner.practitionerId && owner.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  );

  // The chart lets only someone on this list chart as the provider, so only they can take a visit over.
  const iAmProvider = !!data?.providers.some((provider) => provider.profile === user?.profile);
  return { owners, myPractitionerId, iAmProvider, isLoading };
};
