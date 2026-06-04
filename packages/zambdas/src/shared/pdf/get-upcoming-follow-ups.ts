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

/**
 * Upcoming follow-ups linked to `originEncounterId`, sorted by datetime ascending.
 *
 * Membership matches the EHR sidebar: any child encounter (has `partOf`), regardless of status or
 * subtype. Only visits at or after generation time are kept; past ones are dropped.
 */
export const getUpcomingFollowUps = async (
  oystehr: Oystehr,
  originEncounterId: string,
  fallbackTimezone: string
): Promise<UpcomingFollowUp[]> => {
  // Origin encounter → follow-up children (part-of), iterate-including each child's appointment,
  // location, and that location's schedule. Origin itself returns too but is dropped (no `partOf`).
  const items = (
    await oystehr.fhir.search<Encounter | Appointment | Location | Schedule>({
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
        if (item.partOf) followUpEncounters.push(item);
        break;
    }
  }

  const appointmentStartMap = buildAppointmentStartMap(items);
  const generatedAt = DateTime.now();

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
  const upcoming = followUps.filter((followUp) => {
    // No/invalid datetime → keep, so we never silently drop a follow-up.
    if (!followUp.startIso) return true;
    const visitDateTime = DateTime.fromISO(followUp.startIso);
    if (!visitDateTime.isValid) return true;
    // Compare epoch millis: FHIR datetimes carry their offset, so this is timezone-safe.
    return visitDateTime.toMillis() >= generatedAtMillis;
  });

  return upcoming.sort((a, b) => a.startIso.localeCompare(b.startIso));
};
