import Oystehr from '@oystehr/sdk';
import { HealthcareService, PractitionerRole, Schedule, Slot } from 'fhir/r4b';
import {
  checkSlotAvailable,
  getGroupAssignmentMode,
  getSlotAtLocationId,
  getSlotBookedViaGroupId,
  ScheduleOwnerFhirResource,
} from 'utils';
import { getSchedules, resolveBookingLocationId } from '../../../shared';

export interface GroupMemberFallbackInput {
  slot: Slot;
  schedule: Schedule;
  scheduleOwner: ScheduleOwnerFhirResource;
  oystehrClient: Oystehr;
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
  const { slot, schedule, scheduleOwner, oystehrClient } = input;

  const bookedViaGroupId = getSlotBookedViaGroupId(slot);
  if (!bookedViaGroupId) return null;

  const groupHs = (
    await oystehrClient.fhir
      .search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [{ name: '_id', value: bookedViaGroupId }],
      })
      .catch(() => undefined)
  )?.unbundle()[0];
  if (!groupHs) return null;
  if (getGroupAssignmentMode(groupHs) !== 'anonymous') return null;

  const originatingLocationId = resolveBookingLocationId({ scheduleOwner, slot });
  if (!originatingLocationId) return null;

  const { scheduleList } = await getSchedules(oystehrClient, 'group', { id: bookedViaGroupId });

  const candidates = scheduleList.filter((entry) => {
    if (entry.schedule.id === schedule.id) return false;
    if (entry.owner.resourceType !== 'PractitionerRole') return false;
    const role = entry.owner as PractitionerRole;
    const locIds = (role.location ?? []).map((l) => l.reference?.split('/')[1]).filter((id): id is string => !!id);
    return locIds.includes(originatingLocationId);
  });

  for (const candidate of candidates) {
    const candidateSlot: Slot = {
      ...slot,
      schedule: { reference: `Schedule/${candidate.schedule.id}` },
    };
    const isAvailable = await checkSlotAvailable(
      { slot: candidateSlot, schedule: candidate.schedule, excludeSlotId: slot.id },
      oystehrClient
    );
    if (!isAvailable) continue;

    const candidateRole = candidate.owner as PractitionerRole;
    const candidateLocIds = (candidateRole.location ?? [])
      .map((l) => l.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    const needsAtLocationStamp = candidateLocIds.length > 1 && !getSlotAtLocationId(slot);

    return {
      schedule: candidate.schedule,
      scheduleOwner: candidate.owner,
      locationStampNeeded: needsAtLocationStamp ? originatingLocationId : undefined,
    };
  }

  return null;
}
