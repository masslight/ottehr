import { useQuery } from '@tanstack/react-query';
import { HealthcareService, Location, PractitionerRole } from 'fhir/r4b';
import { getGroupAllLocations, isPractitionerRoleMemberOfGroup } from 'utils';
import { useApiClients } from '../../../../hooks/useAppClients';

const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Returns the unique Practitioner IDs that belong to the given group HS,
 * resolved from FHIR via all three membership sources `isPractitionerRoleMemberOfGroup`
 * recognises: (a) `PractitionerRole.service` back-ref to the group, (b)
 * `PractitionerRole.location` overlap with the group's Locations, and (c)
 * `allLocations` widening (every active PR counts when the group has the
 * characteristic). Mirrors `getGroupMemberPractitionerRoleSchedules` on the
 * zambda side. Returns `undefined` while loading or when no group is passed.
 */
export function useGroupMemberPractitionerIds(group: HealthcareService | undefined): string[] | undefined {
  const { oystehr } = useApiClients();
  const groupId = group?.id;
  const { data } = useQuery({
    queryKey: ['group-member-practitioner-ids', groupId],
    enabled: !!oystehr && !!groupId,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      if (!oystehr || !group?.id) return [];
      const allLocationsFlag = getGroupAllLocations(group) === true;
      const bundle = (
        await oystehr.fhir.search<HealthcareService | Location | PractitionerRole>({
          resourceType: 'HealthcareService',
          params: [
            { name: '_id', value: group.id },
            { name: '_include', value: 'HealthcareService:location' },
            { name: '_revinclude:iterate', value: 'PractitionerRole:service' },
            { name: '_revinclude:iterate', value: 'PractitionerRole:location' },
          ],
        })
      ).unbundle();
      // allLocations widening: every active PR in the project counts as a member.
      // Pull them in and dedupe before walking membership.
      if (allLocationsFlag) {
        const widened = (
          await oystehr.fhir.search<PractitionerRole>({
            resourceType: 'PractitionerRole',
            params: [
              { name: 'active', value: 'true' },
              { name: '_count', value: '1000' },
            ],
          })
        ).unbundle();
        const seen = new Set(bundle.map((r) => `${r.resourceType}/${r.id}`));
        for (const r of widened) {
          const key = `${r.resourceType}/${r.id}`;
          if (!seen.has(key)) {
            bundle.push(r);
            seen.add(key);
          }
        }
      }
      // Collect inactive Location IDs from the bundle so the walker can
      // drop them from the group's effective member-Locations. Without
      // this, a Location flipped to inactive after being added to the
      // group would still contribute its providers to the picker.
      const inactiveLocationIds = new Set<string>();
      for (const res of bundle) {
        if (res.resourceType === 'Location' && res.id && (res as Location).status === 'inactive') {
          inactiveLocationIds.add(res.id);
        }
      }
      const ids = new Set<string>();
      for (const res of bundle) {
        if (res.resourceType !== 'PractitionerRole') continue;
        const role = res as PractitionerRole;
        if (!isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag, inactiveLocationIds })) continue;
        const ref = role.practitioner?.reference;
        const id = ref?.startsWith('Practitioner/') ? ref.slice('Practitioner/'.length) : undefined;
        if (id) ids.add(id);
      }
      return Array.from(ids);
    },
  });
  return data;
}
