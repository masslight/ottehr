import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { enrollPractitioner, listActiveLocations, listScheduleOwners } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { useAuthToken } from 'src/hooks/useAuthToken';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { ListActiveLocationsOutput } from 'utils/lib/types/api/locations';
import { CheckPractitionerEnrollmentOutput } from 'utils/lib/types/api/practitioner-enrollment.types';
import { ListScheduleOwnersResponse } from 'utils/lib/types/api/schedules';

/** By name, a nameless one last, then by id, so the same location is picked every time. */
const byName = (a: { name?: string; id?: string }, b: { name?: string; id?: string }): number =>
  Number(!a.name) - Number(!b.name) ||
  (a.name ?? '').localeCompare(b.name ?? '') ||
  (a.id ?? '').localeCompare(b.id ?? '');

/**
 * The Location Surescripts lists for this provider: their first active schedule location (by location
 * name, then id), else the practice's first active Location by name.
 */
export const pickEnrollmentLocationId = (
  practitionerId: string,
  providers: ListScheduleOwnersResponse,
  { locations }: ListActiveLocationsOutput
): string | undefined => {
  const activeLocationIds = new Set(locations.map((location) => location.id));
  const scheduleLocationIds = (providers.list.find((item) => item.owner.id === practitionerId)?.schedules ?? [])
    .filter((schedule) => schedule.active !== false && activeLocationIds.has(schedule.locationId ?? ''))
    .map((schedule) => ({ id: schedule.locationId, name: schedule.locationName }))
    .sort(byName)
    .map((location) => location.id);
  return scheduleLocationIds[0] ?? [...locations].sort(byName)[0]?.id;
};

export const useEnrollSurescriptsPractitioner = (): UseMutationResult<
  CheckPractitionerEnrollmentOutput,
  Error,
  void
> => {
  const token = useAuthToken();
  const user = useEvolveUser();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const practitionerId = user?.profileResource?.id;

  return useMutation({
    mutationFn: async () => {
      if (!token || !practitionerId || !oystehrZambda) {
        throw new Error('API client not available');
      }
      const [providers, activeLocations] = await Promise.all([
        listScheduleOwners({ ownerType: 'Practitioner' }, oystehrZambda),
        listActiveLocations(oystehrZambda),
      ]);
      const locationId = pickEnrollmentLocationId(practitionerId, providers, activeLocations);
      if (!locationId) {
        throw new Error('Surescripts enrollment needs a practice location. Ask an administrator to add one.');
      }
      return enrollPractitioner(token, practitionerId, locationId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['surescripts-practitioner-enrollment'] }),
  });
};
