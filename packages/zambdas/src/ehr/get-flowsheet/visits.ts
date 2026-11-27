import Oystehr from '@oystehr/sdk';
import { Appointment, Condition, Encounter, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { appointmentTypeForAppointment, getReasonForVisitFromAppointment } from 'utils/lib/fhir/appointments';
import { chunkThings } from 'utils/lib/fhir/chat';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS, getEncounterVisitType, getFollowupSubtype } from 'utils/lib/fhir/encounter';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCoding } from 'utils/lib/fhir/helpers';
import { isTelemedAppointment, OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { FlowsheetValues, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { ServiceMode } from 'utils/lib/types/common';
import { TIMEZONES } from 'utils/lib/types/constants';
import { getTimezone } from 'utils/lib/utils/scheduleUtils';
import { followUpVisitHistoryRowFromEncounter } from '../patient-visit-history/get';

export interface VisitResources {
  appointments: Appointment[];
  encounters: Encounter[];
  conditions: Condition[];
  practitioners: Practitioner[];
  locations: Location[];
}

export type VisitDescription = Omit<FlowsheetVisit, 'values' | 'start'> & { start?: string };

export interface VisitColumnOptions {
  now: DateTime;
  currentEncounterId?: string;
}

const ID_SEARCH_CHUNK_SIZE = 100;

const searchByIds = async <T extends Condition | Practitioner>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  ids: (string | undefined)[]
): Promise<T[]> => {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const chunks = await Promise.all(
    chunkThings(unique, ID_SEARCH_CHUNK_SIZE).map((chunk) =>
      getAllFhirSearchPages<T>({ resourceType, params: [{ name: '_id', value: chunk.join(',') }] }, oystehr)
    )
  );
  return chunks.flat();
};

const primaryConditionIdOf = (encounter: Encounter | undefined): string | undefined => {
  const primary = encounter?.diagnosis?.find((d) => d.rank === 1) ?? encounter?.diagnosis?.[0];
  return getIdFromReference(primary?.condition.reference, 'Condition');
};

export const fetchVisits = async (oystehr: Oystehr, patientId: string): Promise<VisitResources> => {
  const patient = `Patient/${patientId}`;
  const [visitResources, followUps] = await Promise.all([
    getAllFhirSearchPages<Appointment | Encounter | Location>(
      {
        resourceType: 'Appointment',
        params: [
          { name: 'patient', value: patient },
          { name: '_tag', value: `${OTTEHR_MODULE.IP},${OTTEHR_MODULE.TM}` },
          { name: '_revinclude', value: 'Encounter:appointment' },
          { name: '_include', value: 'Appointment:location' },
        ],
      },
      oystehr
    ),
    getAllFhirSearchPages<Encounter>(
      {
        resourceType: 'Encounter',
        params: [
          { name: 'subject', value: patient },
          { name: 'type', value: `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}` },
        ],
      },
      oystehr
    ),
  ]);
  const appointments = visitResources.filter((r): r is Appointment => r.resourceType === 'Appointment');
  const linked = visitResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const encounters = [...linked, ...followUps.filter((f) => !linked.some((e) => e.id === f.id))];
  const locations = visitResources.filter((r): r is Location => r.resourceType === 'Location');

  const [conditions, practitioners] = await Promise.all([
    searchByIds<Condition>(oystehr, 'Condition', encounters.map(primaryConditionIdOf)),
    searchByIds<Practitioner>(oystehr, 'Practitioner', encounters.map(getAttendingPractitionerId)),
  ]);
  return { appointments, encounters, conditions, practitioners, locations };
};

const appointmentOf = (encounter: Encounter | undefined, resources: VisitResources): Appointment | undefined => {
  const appointmentId = getIdFromReference(encounter?.appointment?.[0]?.reference, 'Appointment');
  return resources.appointments.find((a) => a.id === appointmentId);
};

const serviceCategoryOf = (appointment: Appointment | undefined): string | undefined => {
  const coding = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM);
  return coding?.code ?? coding?.display;
};

export const describeVisit = (encounterId: string, resources: VisitResources): VisitDescription => {
  const encounter = resources.encounters.find((e) => e.id === encounterId);
  const appointment = appointmentOf(encounter, resources);
  const visitType = getEncounterVisitType(encounter);
  const isFollowUp = !!encounter && visitType !== 'main';
  const original = isFollowUp
    ? resources.encounters.find((e) => e.id === getIdFromReference(encounter?.partOf?.reference, 'Encounter'))
    : undefined;

  const coding = resources.conditions.find((c) => c.id === primaryConditionIdOf(encounter))?.code?.coding?.[0];
  const attendingId = encounter && getAttendingPractitionerId(encounter);
  const attending = resources.practitioners.find((p) => p.id === attendingId);
  const locationId = getIdFromReference(
    appointment?.participant.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor?.reference,
    'Location'
  );
  const location = resources.locations.find((l) => l.id === locationId);
  const followUpRow =
    encounter && original
      ? followUpVisitHistoryRowFromEncounter(encounter, {
          practitioners: resources.practitioners,
          locations: resources.locations,
          originalEncounter: original,
          serviceCategory: serviceCategoryOf(appointmentOf(original, resources)),
          appointments: resources.appointments,
        })
      : undefined;

  return {
    appointmentId: appointment?.id,
    encounterId: encounter?.id,
    // An annotation or free-form follow-up has no appointment of its own; a linked one is the original visit's.
    start: (visitType !== 'follow-up' && appointment?.start) || undefined,
    timezone: location && getTimezone(location),
    isFollowUp,
    ...(encounter && isFollowUp
      ? {
          followupSubtype: getFollowupSubtype(encounter),
          originalAppointmentId: getIdFromReference(original?.appointment?.[0]?.reference, 'Appointment'),
        }
      : {}),
    ...(followUpRow ? { followUpType: followUpRow.type } : {}),
    appointmentType: appointment && appointmentTypeForAppointment(appointment),
    serviceMode: appointment && (isTelemedAppointment(appointment) ? ServiceMode.virtual : ServiceMode['in-person']),
    serviceCategory: followUpRow ? followUpRow.serviceCategory : serviceCategoryOf(appointment),
    reason: (followUpRow ? followUpRow.visitReason : getReasonForVisitFromAppointment(appointment)) ?? '',
    primaryDiagnosis: coding ? [coding.code, coding.display].filter(Boolean).join(': ') : '',
    provider: attending ? `${getFirstName(attending)} ${getLastName(attending)}` : '',
  };
};

export const byInstant = (a: string | undefined, b: string | undefined): number =>
  (Date.parse(a ?? '') || 0) - (Date.parse(b ?? '') || 0);

const isNotHeld = (encounter: Encounter, resources: VisitResources): boolean => {
  const status = appointmentOf(encounter, resources)?.status;
  return status === 'cancelled' || status === 'noshow' || encounter.status === 'cancelled';
};

const startsAfterToday = (visit: VisitDescription & { start: string }, now: DateTime): boolean => {
  return DateTime.fromISO(visit.start, { zone: visit.timezone ?? TIMEZONES[0] }).startOf('day') > now;
};

export const buildVisitColumns = (
  resources: VisitResources,
  valuesByEncounter: Map<string, FlowsheetValues>,
  { now, currentEncounterId }: VisitColumnOptions
): FlowsheetVisit[] => {
  const firstReadingTime = (values: FlowsheetValues): string | undefined =>
    Object.values(values)
      .flatMap((readings) => readings.map((reading) => reading.time))
      .sort(byInstant)[0];

  const visits: FlowsheetVisit[] = [];
  resources.encounters.forEach((encounter) => {
    if (!encounter.id || encounter.status === 'entered-in-error') return;
    const values = valuesByEncounter.get(encounter.id) ?? {};
    const hasReadings = Object.keys(values).length > 0;
    const visit = describeVisit(encounter.id, resources);
    const start = visit.start ?? firstReadingTime(values);
    if (!start) return;
    const isCurrent = encounter.id === currentEncounterId;
    const isHidden = isNotHeld(encounter, resources) || (!isCurrent && startsAfterToday({ ...visit, start }, now));
    if (!hasReadings && isHidden) return;
    visits.push({ ...visit, start, values });
  });

  valuesByEncounter.forEach((values, encounterId) => {
    if (resources.encounters.some((e) => e.id === encounterId)) return;
    const start = firstReadingTime(values);
    if (!start) return;
    visits.push({ isFollowUp: false, reason: '', primaryDiagnosis: '', provider: '', start, values });
  });

  return visits.sort((a, b) => byInstant(b.start, a.start));
};
