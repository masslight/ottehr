import { Location, PractitionerRole } from 'fhir/r4b';
import { isLocationBookable } from 'utils/lib/fhir/location';

/** Just enough of a schedule-list entry to decide where it can be delivered. */
interface ScheduleOwnerEntry {
  owner: { resourceType: string; id?: string };
}

/**
 * Whether a schedule can still be delivered somewhere bookable.
 *
 * Deactivating a Location must stop it vending slots, and pruning the *qualifying Location ids*
 * isn't enough on its own: an empty set takes neither the `atLocationSlug` branch nor the
 * multi-Location picker branch, so the schedules fall straight through and vend anyway. The
 * schedules themselves have to be dropped, which is what this predicate decides.
 *
 * @param bookableLocationById Locations already confirmed bookable — membership IS the check, since
 * the lookup that populates it filters deactivated Locations out at the server.
 */
export const isEntryAtBookableLocation = (
  entry: ScheduleOwnerEntry,
  bookableLocationById: Map<string, Location>
): boolean => {
  if (entry.owner.resourceType === 'Location') {
    return isLocationBookable(entry.owner as Location);
  }

  if (entry.owner.resourceType === 'PractitionerRole') {
    const locationRefs = (entry.owner as PractitionerRole).location ?? [];
    // A provider with no Location at all has none to deactivate. Keeping it preserves how
    // Location-less provider schedules already behave; dropping it here would quietly break them.
    if (locationRefs.length === 0) return true;
    return locationRefs.some((ref) => {
      const id = ref.reference?.split('/')[1];
      return id ? bookableLocationById.has(id) : false;
    });
  }

  // HealthcareService / Practitioner owners have no Location of their own to judge, so they pass
  // through — the same treatment the surrounding narrowing logic gives them.
  return true;
};
