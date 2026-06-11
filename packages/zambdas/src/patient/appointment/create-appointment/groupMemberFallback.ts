import Oystehr from '@oystehr/sdk';
import { HealthcareService, Schedule, Slot } from 'fhir/r4b';
import {
  checkSlotAvailable,
  getGroupAssignmentMode,
  getSlotAtLocationId,
  getSlotBookedViaGroupId,
  ScheduleOwnerFhirResource,
} from 'utils';
import { getGroupMemberPractitionerRoleSchedules, resolveBookingLocationId } from '../../../shared';

export interface GroupMemberFallbackInput {
  slot: Slot;
  schedule: Schedule;
  scheduleOwner: ScheduleOwnerFhirResource;
  oystehrClient: Oystehr;
  /**
   * Pre-resolved cadence for the slot's service category. Forwarded into
   * each per-candidate checkSlotAvailable call so the FHIR catalog isn't
   * paginated once per candidate schedule. Omit when no service category is
   * configured (the resolver inside checkSlotAvailable is a no-op for that
   * case anyway).
   */
  cadenceMinutes?: number;
}

export interface GroupMemberFallbackResult {
  schedule: Schedule;
  scheduleOwner: ScheduleOwnerFhirResource;
  /**
   * When set, the swapped Slot must have a slot-at-location extension added
   * pointing at this Location id. Set iff the fallback candidate is a
   * multi-Location PractitionerRole AND the original Slot didn't carry an
   * at-location stamp (which it wouldn't have if the original PR was
   * single-Location). Without this, the swapped Slot would be ambiguous
   * about where the booking is actually happening.
   */
  locationStampNeeded?: string;
}

/**
 * Anonymous-mode group fallback: when the originally-targeted member
 * Schedule fails the capacity guard, attempt to reroute the booking to
 * another member of the same group whose Schedule has capacity AT THE SAME
 * Location. Returns null when fallback is not eligible (non-group booking,
 * provider-mode group, no resolvable originating Location, no candidates
 * with capacity at the same Location). The caller is responsible for
 * mutating the Slot's schedule.reference + meta.tag + (optional) at-location
 * extension once a winner is returned.
 */
export async function tryGroupMemberFallback(
  input: GroupMemberFallbackInput
): Promise<GroupMemberFallbackResult | null> {
  const { slot, schedule, scheduleOwner, oystehrClient, cadenceMinutes } = input;

  const bookedViaGroupId = getSlotBookedViaGroupId(slot);
  if (!bookedViaGroupId) return null;

  // Distinguish the two failure modes that used to be silently coalesced:
  //   (1) FHIR search itself fails — let the error surface (caller renders a
  //       5xx); swallowing turned every transient or auth failure into a
  //       silent "no fallback".
  //   (2) Search succeeds but no HS exists for the id — slot's
  //       bookedViaGroupId extension references a resource that's been
  //       deleted (or was never written correctly). That's a slot/group data
  //       integrity issue worth surfacing, not a fallback-not-applicable
  //       business case.
  const groupHs = (
    await oystehrClient.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [{ name: '_id', value: bookedViaGroupId }],
    })
  ).unbundle()[0];
  if (!groupHs) {
    // Unknown-shape error → unwrapped Error so wrapHandler's topLevelCatch
    // routes it through observability as a 500.
    throw new Error(`Slot's bookedViaGroupId=${bookedViaGroupId} references a HealthcareService that does not exist.`);
  }
  if (getGroupAssignmentMode(groupHs) !== 'anonymous') return null;

  const originatingLocationId = resolveBookingLocationId({ scheduleOwner, slot });
  if (!originatingLocationId) return null;

  const memberPairs = await getGroupMemberPractitionerRoleSchedules(oystehrClient, groupHs);

  const candidates = memberPairs.filter((entry) => {
    if (entry.schedule.id === schedule.id) return false;
    const locIds = (entry.role.location ?? [])
      .map((l) => l.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    return locIds.includes(originatingLocationId);
  });

  for (const candidate of candidates) {
    const candidateSlot: Slot = {
      ...slot,
      schedule: { reference: `Schedule/${candidate.schedule.id}` },
    };
    const isAvailable = await checkSlotAvailable(
      { slot: candidateSlot, schedule: candidate.schedule, excludeSlotId: slot.id, cadenceMinutes },
      oystehrClient
    );
    if (!isAvailable) continue;

    const candidateLocIds = (candidate.role.location ?? [])
      .map((l) => l.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    const needsAtLocationStamp = candidateLocIds.length > 1 && !getSlotAtLocationId(slot);

    return {
      schedule: candidate.schedule,
      scheduleOwner: candidate.role,
      locationStampNeeded: needsAtLocationStamp ? originatingLocationId : undefined,
    };
  }

  return null;
}
