import Oystehr from '@oystehr/sdk';
import { Schedule } from 'fhir/r4b';
import { getLocationResource, isLocationBookable } from 'utils/lib/fhir/location';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';

export const INACTIVE_LOCATION_SLOT_ERROR_MESSAGE = 'This location is not currently accepting visits.';

// Rejects slots on a deactivated Location's own schedule; a stale walk-in or booking page can still reach here.
export const assertScheduleLocationActorBookable = async (schedule: Schedule, oystehr: Oystehr): Promise<void> => {
  const [actorType, actorId] = schedule.actor?.[0]?.reference?.split('/') ?? [];
  if (actorType !== 'Location' || !actorId) return;
  const location = await getLocationResource(actorId, oystehr);
  if (location && !isLocationBookable(location)) {
    throw INVALID_INPUT_ERROR(INACTIVE_LOCATION_SLOT_ERROR_MESSAGE);
  }
};
