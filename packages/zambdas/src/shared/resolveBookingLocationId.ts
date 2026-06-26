import { PractitionerRole, Slot } from 'fhir/r4b';
import { getSlotAtLocationId, ScheduleOwnerFhirResource } from 'utils';

/**
 * Resolves the Location id that an Appointment should be attributed to,
 * based on the Slot and its Schedule's actor. Precedence:
 *
 *   1. Location-actor → owner's id (unambiguous: the actor IS the Location).
 *   2. PractitionerRole-actor with exactly one `location[]` entry → that id
 *      (the actor unambiguously identifies a single Location).
 *   3. Otherwise (HealthcareService-actor, multi-location PR-actor,
 *      Practitioner-actor) → the Slot's `slot-at-location` extension.
 *
 * Returns undefined when no source resolves to a Location — e.g., an HS-
 * actored slot whose extension was never stamped, or a Practitioner-
 * actored slot (no Location field, no extension).
 *
 * Pure function: no FHIR I/O. The caller materialises the Location
 * resource by id (and may short-circuit the fetch when scheduleOwner IS
 * the Location).
 */
export function resolveBookingLocationId(input: {
  scheduleOwner: ScheduleOwnerFhirResource;
  slot: Slot;
}): string | undefined {
  const { scheduleOwner, slot } = input;

  if (scheduleOwner.resourceType === 'Location') {
    return scheduleOwner.id;
  }

  if (scheduleOwner.resourceType === 'PractitionerRole') {
    const role = scheduleOwner as PractitionerRole;
    const prLocationIds = (role.location ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    if (prLocationIds.length === 1) {
      return prLocationIds[0];
    }
  }

  return getSlotAtLocationId(slot);
}
