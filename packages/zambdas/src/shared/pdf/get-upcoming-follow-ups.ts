import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { buildAppointmentStartMap, getEncounterDateTime, isScheduledFollowupEncounter } from 'utils';
import { resolveTimezone } from '../helpers';

// Raw follow-up data; display formatting lives in `composeUpcomingVisits`.
export interface UpcomingFollowUp {
  startIso: string;
  timezone: string;
  locationName: string;
  reason: string;
}

const resolveFollowUpReason = (encounter: Encounter, ownAppointment?: Appointment): string => {
  // Scheduled follow-ups carry the reason on their appointment; annotation ones on the encounter.
  if (ownAppointment?.description) return ownAppointment.description;
  const reasonCode = encounter.reasonCode?.[0];
  return reasonCode?.text || reasonCode?.coding?.[0]?.display || '';
};

// Statuses where a scheduled follow-up is no longer upcoming: signed/completed, cancelled/no-show, voided.
const INACTIVE_SCHEDULED_FOLLOWUP_STATUSES: Encounter['status'][] = ['finished', 'cancelled', 'entered-in-error'];

const isInactiveScheduledFollowup = (encounter: Encounter): boolean =>
  INACTIVE_SCHEDULED_FOLLOWUP_STATUSES.includes(encounter.status);

type FollowUpResource = Encounter | Appointment | Location | Schedule;

/**
 * Pure core of `getUpcomingFollowUps`, split out so it's unit-testable with in-memory resources.
 *
 * Returns, sorted ascending, only scheduled follow-up *visits* that are still upcoming — annotation
 * follow-ups (tracking tasks) are excluded as this is patient-facing. "Upcoming" means at/after
 * `generatedAt` and strictly after the current document's own visit (`excludeEncounterId`), so an
 * earlier sibling doesn't appear on a later one's document.
 */
export const selectUpcomingFollowUps = (
  items: FollowUpResource[],
  {
    fallbackTimezone,
    generatedAt,
    excludeEncounterId,
  }: { fallbackTimezone: string; generatedAt: DateTime; excludeEncounterId?: string }
): UpcomingFollowUp[] => {
  const appointmentsById = new Map<string, Appointment>();
  const locationsById = new Map<string, Location>();
  const schedulesByLocationRef = new Map<string, Schedule>();
  const followUpEncounters: Encounter[] = [];

  for (const item of items) {
    switch (item.resourceType) {
      case 'Appointment':
        if (item.id) appointmentsById.set(item.id, item);
        break;
      case 'Location':
        if (item.id) locationsById.set(item.id, item);
        break;
      case 'Schedule': {
        const actorRef = item.actor?.find((a) => a.reference?.startsWith('Location/'))?.reference;
        if (actorRef) schedulesByLocationRef.set(actorRef, item);
        break;
      }
      case 'Encounter':
        // Scheduled follow-up visits only (not annotation tracking tasks), excluding this document's
        // own visit and any no longer upcoming.
        if (
          item.partOf &&
          item.id !== excludeEncounterId &&
          isScheduledFollowupEncounter(item) &&
          !isInactiveScheduledFollowup(item)
        ) {
          followUpEncounters.push(item);
        }
        break;
    }
  }

  // The visit this document is for; its start bounds the upcoming window below.
  const currentEncounter = items.find(
    (item): item is Encounter => item.resourceType === 'Encounter' && item.id === excludeEncounterId
  );

  const appointmentStartMap = buildAppointmentStartMap(items);

  const followUps: UpcomingFollowUp[] = followUpEncounters.map((encounter) => {
    // Annotation follow-ups share the parent appointment, so only scheduled ones own one.
    const appointmentId = encounter.appointment?.[0]?.reference?.replace('Appointment/', '');
    const ownAppointment =
      appointmentId && isScheduledFollowupEncounter(encounter) ? appointmentsById.get(appointmentId) : undefined;

    const locationRef = encounter.location?.[0]?.location?.reference;
    const location = locationRef ? locationsById.get(locationRef.replace('Location/', '')) : undefined;
    const schedule = locationRef ? schedulesByLocationRef.get(locationRef) : undefined;

    return {
      startIso: getEncounterDateTime(encounter, appointmentStartMap) ?? '',
      timezone: resolveTimezone(schedule, location, fallbackTimezone),
      locationName: location?.name ?? '',
      reason: resolveFollowUpReason(encounter, ownAppointment),
    };
  });

  const generatedAtMillis = generatedAt.toMillis();
  const currentVisitStartIso = currentEncounter
    ? getEncounterDateTime(currentEncounter, appointmentStartMap)
    : undefined;
  const currentVisitStartDateTime = currentVisitStartIso ? DateTime.fromISO(currentVisitStartIso) : undefined;
  const currentVisitStartMillis = currentVisitStartDateTime?.isValid ? currentVisitStartDateTime.toMillis() : undefined;

  const upcoming = followUps.filter((followUp) => {
    // Never silently drop a follow-up with no resolvable datetime.
    if (!followUp.startIso) return true;
    const visitDateTime = DateTime.fromISO(followUp.startIso);
    if (!visitDateTime.isValid) return true;
    // Millis comparison is timezone-safe; keep visits at/after now and after the current visit.
    const visitMillis = visitDateTime.toMillis();
    if (visitMillis < generatedAtMillis) return false;
    if (currentVisitStartMillis !== undefined && visitMillis <= currentVisitStartMillis) return false;
    return true;
  });

  return upcoming.sort((a, b) => a.startIso.localeCompare(b.startIso));
};

/** Fetches follow-ups under `originEncounterId`; filtering/sorting lives in `selectUpcomingFollowUps`. */
export const getUpcomingFollowUps = async (
  oystehr: Oystehr,
  originEncounterId: string,
  fallbackTimezone: string,
  excludeEncounterId?: string
): Promise<UpcomingFollowUp[]> => {
  // Parent encounter + its follow-up children (part-of), each child's appointment and location,
  // and that location's schedule.
  const items = (
    await oystehr.fhir.search<FollowUpResource>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: originEncounterId },
        { name: '_revinclude', value: 'Encounter:part-of' },
        { name: '_include:iterate', value: 'Encounter:appointment' },
        { name: '_include:iterate', value: 'Encounter:location' },
        { name: '_revinclude:iterate', value: 'Schedule:actor:Location' },
      ],
    })
  ).unbundle();

  return selectUpcomingFollowUps(items, { fallbackTimezone, generatedAt: DateTime.now(), excludeEncounterId });
};
