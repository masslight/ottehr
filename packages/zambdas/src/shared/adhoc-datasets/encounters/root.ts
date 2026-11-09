// The base of the encounters dataset: the root resources, the base row of each encounter, and the few
// root-only lookups the base row needs (registrar names, location schedules, provider groups).
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Appointment, Encounter, HealthcareService, Location, Patient, Practitioner, Schedule } from 'fhir/r4b';
import {
  appointmentTypeForAppointment,
  getAppointmentRoom,
  getCancellationReasonDisplay,
  getReasonForVisitAndAdditionalDetailsFromAppointment,
} from 'utils/lib/fhir/appointments';
import { getPaymentVariantFromEncounter, PaymentVariant } from 'utils/lib/fhir/encounter';
import {
  getEmailForIndividual,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import { getAdmitterPractitionerId } from 'utils/lib/fhir/practitioners';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { getProviderType } from 'utils/lib/helpers/helpers';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { PROVIDER_TYPE_VALUES } from 'utils/lib/types/api/practitioner.types';
import { CREATED_BY_SYSTEM } from 'utils/lib/types/common';
import { PATIENT_POINT_OF_DISCOVERY_URL } from 'utils/lib/types/constants';
import { getScheduleExtension, getTimezone } from 'utils/lib/utils/scheduleUtils';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import {
  buildEncounterRowContext,
  fetchAppointmentReportResources,
  fetchScopedResources,
  knownValueOrNull,
} from '../../adhoc-report';
import { EncounterRoot, EncounterRowInput } from './context';
import { groupIdOf, minutesBetween, openHoursOnDay, practitionerDisplayName } from './helpers';

/**
 * The appointments of the range with their encounters, patients, locations and attending / intake
 * practitioners. The Encounters dataset also walks Encounter:part-of so a follow-up encounter resolves to its
 * parent's appointment.
 */
export async function fetchEncounterRoot(
  oystehr: Oystehr,
  dateRange: { start: string; end: string }
): Promise<{ root: EncounterRoot; practitioners: Practitioner[] }> {
  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner;
  const allResources = await fetchAppointmentReportResources<ReportResource>(oystehr, {
    dateRange,
    extraParams: [{ name: '_revinclude:iterate', value: 'Encounter:part-of' }],
  });

  const root: EncounterRoot = {
    appointmentMap: new Map(),
    patientMap: new Map(),
    locationMap: new Map(),
    encounterById: new Map(),
  };
  const practitioners: Practitioner[] = [];

  for (const r of allResources) {
    switch (r.resourceType) {
      case 'Appointment':
        if (r.id) root.appointmentMap.set(`Appointment/${r.id}`, r);
        break;
      case 'Patient':
        if (r.id) root.patientMap.set(`Patient/${r.id}`, r);
        break;
      case 'Location':
        if (r.id) root.locationMap.set(`Location/${r.id}`, r);
        break;
      case 'Practitioner':
        practitioners.push(r);
        break;
      case 'Encounter':
        if (r.id) root.encounterById.set(r.id, r);
        break;
    }
  }

  return { root, practitioners };
}

async function getStaffNameByEmail(oystehr: Oystehr): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const users = await oystehr.user.list();
    const pidByEmail = new Map<string, string>();

    for (const u of users) {
      const email = (u.email || '').toLowerCase().trim();
      const pid = getIdFromReference(u.profile, 'Practitioner');
      if (email && pid) pidByEmail.set(email, pid);
    }

    const nameById = new Map<string, string>();

    for (const p of await fetchScopedResources<Practitioner>(
      oystehr,
      'Practitioner',
      '_id',
      Array.from(pidByEmail.values()),
      [{ name: '_elements', value: 'id,name' }]
    )) {
      const nm = `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`.trim();
      if (p.id && nm) nameById.set(p.id, nm);
    }

    for (const [email, pid] of pidByEmail) {
      const nm = nameById.get(pid);
      if (nm) map.set(email, nm);
    }
  } catch (e) {
    console.warn('adhoc-encounters: registrar name resolution failed, falling back to email', e);
    captureException(e);
  }
  return map;
}

/** What the base row reads beyond the root: registrar names, each location's Schedule, provider group names. */
export interface EncounterBaseLookups {
  staffNames: Map<string, string>;
  scheduleByLocationId: Map<string, Schedule>;
  groupNameById: Map<string, string>;
}

/** Runs next to the layers, not after them: it needs only the root. */
export async function fetchEncounterBaseLookups(oystehr: Oystehr, root: EncounterRoot): Promise<EncounterBaseLookups> {
  const groupIds = Array.from(
    new Set(
      Array.from(root.appointmentMap.values())
        .map(groupIdOf)
        .filter((id): id is string => !!id)
    )
  );

  const [staffNames, schedules, groups] = await Promise.all([
    getStaffNameByEmail(oystehr),
    // Each location's Schedule, for the operating hours on the visit day.
    fetchScopedResources<Schedule>(
      oystehr,
      'Schedule',
      'actor',
      Array.from(root.locationMap.values())
        .filter((loc) => loc.id)
        .map((loc) => `Location/${loc.id}`)
    ),
    // Visits booked through a provider group carry the group (HealthcareService) as a participant.
    fetchScopedResources<HealthcareService>(oystehr, 'HealthcareService', '_id', groupIds, [
      { name: '_elements', value: 'id,name' },
    ]),
  ]);

  const scheduleByLocationId = new Map<string, Schedule>();

  for (const schedule of schedules) {
    const locationId = getIdFromReference(
      schedule.actor?.find((a) => a.reference?.startsWith('Location/'))?.reference,
      'Location'
    );

    if (locationId && !scheduleByLocationId.has(locationId) && getScheduleExtension(schedule)) {
      scheduleByLocationId.set(locationId, schedule);
    }
  }

  const groupNameById = new Map<string, string>();
  for (const group of groups) if (group.id && group.name) groupNameById.set(group.id, group.name);

  return { staffNames, scheduleByLocationId, groupNameById };
}

/** The base row of one encounter, and what the layers' `map` reads for it. */
export function buildEncounterBaseRow(
  encounter: Encounter,
  appointment: Appointment,
  root: EncounterRoot,
  practitionerMap: Map<string, Practitioner>,
  lookups: EncounterBaseLookups,
  timezoneForLocation: (location: Location) => string
): { row: AdHocEncounterRow; input: EncounterRowInput } {
  const { encounterById, patientMap, locationMap } = root;
  const { staffNames, scheduleByLocationId, groupNameById } = lookups;

  const {
    encounterType,
    isFollowUpRow,
    patient,
    locationRef,
    location,
    attendingId,
    attendingProvider,
    visitType,
    visitStatus,
    serviceCategory,
    address,
    start,
  } = buildEncounterRowContext(encounter, appointment, { encounterById, patientMap, locationMap, practitionerMap });

  // Operating hours live in the location's Schedule extension (the Schedule tab), not in
  // Location.hoursOfOperation, which nothing in the app reads.
  const clinicOpenHours =
    start && location
      ? openHoursOnDay(
          (location.id ? scheduleByLocationId.get(location.id) : undefined) ?? location,
          start,
          // The clinic's own timezone, as for the visit day everywhere else in the row.
          timezoneForLocation(location)
        )
      : null;

  const createdBy = appointment.meta?.tag?.find((t) => t.system === CREATED_BY_SYSTEM)?.display ?? '';

  const registrationChannel = createdBy.startsWith('Staff')
    ? 'Staff'
    : createdBy.startsWith('QR - Patient')
    ? 'Walk-in'
    : createdBy.startsWith('Patient')
    ? 'Self-scheduled'
    : 'Unknown';

  const registeredBy = createdBy.startsWith('Staff') ? createdBy.replace(/^Staff\s*/, '').trim() : 'Patient';

  const regEmail = registeredBy.includes('@')
    ? registeredBy
        .replace(/ via QRS$/, '')
        .trim()
        .toLowerCase()
    : '';

  const registeredByName = (regEmail && staffNames.get(regEmail)) || registeredBy;
  const locationId = locationRef ? locationRef.replace('Location/', '') : undefined;
  const statusHistory = getVisitStatusHistory(encounter);
  const currentStatusSince = statusHistory.at(-1)?.period.start ?? null;
  const intakePerformerId = getAdmitterPractitionerId(encounter);
  const reasonParts = getReasonForVisitAndAdditionalDetailsFromAppointment(appointment);
  const groupId = groupIdOf(appointment);
  const attendingPractitioner = attendingId ? practitionerMap.get(attendingId) : undefined;

  const row: AdHocEncounterRow = {
    appointmentId: appointment.id || '',
    encounterId: encounter.id ?? '',
    // RAW ISO instant — the server never zone-formats dates. The client dataset derives the
    // viewer-local yyyy-MM-dd day (and the tracking-board href) in the browser.
    date: start || null,
    startTime: start || '',
    visitType,
    appointmentType: appointmentTypeForAppointment(appointment),
    serviceCategory,
    visitStatus,
    statusHistory: statusHistory.map((entry) => ({
      status: entry.status,
      start: entry.period.start ?? null,
      end: entry.period.end ?? null,
    })),
    encounterType,
    // Reason for visit is the booking's free text (Appointment.description); appointmentType.text
    // is the booking KIND (walk-in / pre-book) and must never stand in for it.
    reason: appointment.description?.trim() || encounter.reasonCode?.[0]?.text || '',
    reasonForVisit: reasonParts.reasonForVisit ?? '',
    reasonDetails: reasonParts.additionalDetails ?? '',
    bookedAt: appointment.created ?? null,
    room: getAppointmentRoom(appointment) ?? '',
    group: groupId ? groupNameById.get(groupId) ?? '' : '',
    trackingBoardNote: appointment.comment ?? '',
    visitStatusSince: currentStatusSince,
    scheduledSlotMinutes: minutesBetween(appointment.start, appointment.end),
    patientId: patient?.id || '',
    firstName: patient ? getPatientFirstName(patient) || '' : '',
    lastName: patient ? getPatientLastName(patient) || '' : '',
    patientName: patient ? [getPatientFirstName(patient), getPatientLastName(patient)].filter(Boolean).join(' ') : '',
    dateOfBirth: patient?.birthDate || null,
    sex: patient?.gender ? mapGenderToLabel[patient.gender] ?? '' : '',
    city: address?.city || '',
    state: address?.state || '',
    zip: address?.postalCode || '',
    phone: (patient ? getPhoneNumberForIndividual(patient) : '') || '',
    email: (patient ? getEmailForIndividual(patient) : '') || '',
    source: patient?.extension?.find((e) => e.url === PATIENT_POINT_OF_DISCOVERY_URL)?.valueString || '',
    location: location?.name || 'Unknown',
    locationId,
    region: location?.address?.state || '',
    clinicOpenHours,
    attendingProvider,
    attendingProviderId: attendingId,
    attendingProviderType: knownValueOrNull(PROVIDER_TYPE_VALUES, getProviderType(attendingPractitioner)),
    intakePerformer:
      practitionerDisplayName(intakePerformerId ? practitionerMap.get(intakePerformerId) : undefined) ?? '',
    intakePerformerId,
    cancellationReason: appointment.cancelationReason?.coding?.[0]?.display ?? '',
    cancellationReasonDisplay: getCancellationReasonDisplay(appointment) ?? '',
    // The visit's payment option, as its Payments panel reads it from the visit's Encounter — for a follow-up note,
    // its parent visit's (the note has no payment option of its own).
    paymentVariant: knownValueOrNull(
      Object.values(PaymentVariant),
      getPaymentVariantFromEncounter(
        (isFollowUpRow && encounter.partOf?.reference
          ? encounterById.get(encounter.partOf.reference.replace('Encounter/', ''))
          : undefined) ?? encounter
      )
    ),
    registrationChannel,
    registeredBy,
    registeredByName,
  };

  return {
    row,
    input: { encounter, appointment, patient, attendingPractitioner, isFollowUpRow, visitStatus, statusHistory },
  };
}

export const timezoneLookup = (): ((loc: Location) => string) => {
  const tzByLocationId = new Map<string, string>();
  return (loc: Location): string => {
    const key = loc.id ?? '';
    let tz = tzByLocationId.get(key);
    if (!tz) {
      tz = getTimezone(loc);
      tzByLocationId.set(key, tz);
    }
    return tz;
  };
};
