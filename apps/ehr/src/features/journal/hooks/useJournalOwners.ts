import { useMemo } from 'react';
import { toProviderDetails, useGetEmployeesWithDetails } from 'src/features/visits/shared/hooks/useGetEmployees';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { ProviderDetails } from 'utils/lib/types/api/encounter.types';
import { RoleType } from 'utils/lib/types/api/user.types';

/** Active Providers and Clinicians (the people who have a journal), with the signed-in user's practitioner id. */
export const useJournalOwners = (): { owners: ProviderDetails[]; myPractitionerId?: string; isLoading: boolean } => {
  const { data, isLoading } = useGetEmployeesWithDetails();
  const user = useEvolveUser();
  const myPractitionerId = user?.profile?.split('/')[1];

  const owners = useMemo(
    () =>
      (data?.all ?? [])
        .filter(
          (employee) =>
            employee.status === 'Active' &&
            (employee.roles.includes(RoleType.Provider) || employee.roles.includes(RoleType.Clinician))
        )
        .map(toProviderDetails)
        .filter((owner) => owner.practitionerId && owner.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  );

  return { owners, myPractitionerId, isLoading };
};
