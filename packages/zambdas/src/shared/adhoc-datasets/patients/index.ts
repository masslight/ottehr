// The patients dataset: root (the appointments of the range folded to one row per patient), then every
// requested layer in parallel — each layer one module (layers.ts), keyed by patient.
import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import {
  getAddressForIndividual,
  getEmailForIndividual,
  getMergedIntoPatientReference,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { AdHocPatientRow, AdHocPatientsInput, PatientLayerId } from 'utils/lib/types/adhoc/datasets/patients';
import { PATIENT_POINT_OF_DISCOVERY_URL } from 'utils/lib/types/constants';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { fetchAppointmentReportResources, REPORT_ATTENDED_APPOINTMENT_STATUSES } from '../../adhoc-report';
import { fetchPatientLayerColumns, PATIENT_LAYER_MODULES } from './layers';

// Per-patient accumulator while we fold the appointment/encounter graph down to one row per patient.
interface PatientAgg {
  patient: Patient;
  visitDates: string[]; // ISO start of each visit in range
  lastVisitStart: string;
  lastVisitStatus: string;
  visitTypes: Set<'In-Person' | 'Telemed'>;
  locations: Set<string>;
  providers: Set<string>;
  serviceCategories: Set<string>;
}

const includeFlag = (id: string): string => `include${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/** The layer ids an endpoint input asks for (its include<Layer> flags). */
export function requestedPatientLayers(params: AdHocPatientsInput): PatientLayerId[] {
  const flags = params as unknown as Record<string, boolean | undefined>;
  return (Object.keys(PATIENT_LAYER_MODULES) as PatientLayerId[]).filter((id) => flags[includeFlag(id)]);
}

// The full fetch+map pipeline, separated from auth/transport so fixture tests can run it against a
// stubbed Oystehr client and assert the mapped rows parse with the endpoint's Zod schema — the same
// schema the runtime output validation uses.
export async function fetchAdHocPatientRows(oystehr: Oystehr, params: AdHocPatientsInput): Promise<AdHocPatientRow[]> {
  const { dateRange } = params;

  type ReportResource = Appointment | Encounter | Patient | Location | Practitioner;

  // Anchored on Appointment in the date range (like the Encounters dataset), but folded to one row
  // per patient. The main search stays light; the layers are loaded afterwards per patient.
  // Attended visits only (no cancelled / no-show): unlike the Encounters/Billing datasets, the
  // per-patient rollups (totalVisits, first/lastVisitDate, locations, providers) carry no per-visit
  // status a report could filter on, so cancelled/no-show visits would silently inflate the counts
  // and disagree with the Recent Patients report.
  const allResources = await fetchAppointmentReportResources<ReportResource>(oystehr, {
    dateRange,
    statuses: REPORT_ATTENDED_APPOINTMENT_STATUSES,
  });

  const appointmentMap = new Map<string, Appointment>();
  const patientMap = new Map<string, Patient>();
  const locationMap = new Map<string, Location>();
  const encounters: Encounter[] = [];

  for (const r of allResources) {
    switch (r.resourceType) {
      case 'Appointment':
        if (r.id) appointmentMap.set(`Appointment/${r.id}`, r);
        break;
      case 'Patient':
        if (r.id) patientMap.set(`Patient/${r.id}`, r);
        break;
      case 'Location':
        if (r.id) locationMap.set(`Location/${r.id}`, r);
        break;
      case 'Encounter':
        encounters.push(r);
        break;
    }
  }

  // Build a quick provider-name lookup off the Encounter participants we included.
  const practitionerNameById = new Map<string, string>();

  for (const r of allResources) {
    if (r.resourceType === 'Practitioner' && r.id) {
      const name = `${r.name?.[0]?.given?.[0] || ''} ${r.name?.[0]?.family || ''}`.trim();
      if (name) practitionerNameById.set(r.id, name);
    }
  }

  const providerNameForEncounter = (encounter: Encounter): string | undefined => {
    // The attending (ATND participant), not the first Practitioner participant (which can be intake
    // staff) — matches the Encounters dataset's attendingProvider so provider rollups agree.
    const id = getAttendingPractitionerId(encounter);
    return id ? practitionerNameById.get(id) : undefined;
  };

  // Fold each appointment (+ its encounter) into its patient's accumulator.
  const aggByPatient = new Map<string, PatientAgg>();
  const encounterByApptRef = new Map<string, Encounter>();

  for (const e of encounters) {
    // An annotation follow-up carries its parent visit's appointment reference; the visit is the main encounter.
    if (isAnnotationFollowupEncounter(e)) continue;

    const apptRef = e.appointment?.[0]?.reference;

    if (apptRef) encounterByApptRef.set(apptRef, e);
  }

  for (const appointment of appointmentMap.values()) {
    const patientRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor
      ?.reference;

    const patient = patientRef ? patientMap.get(patientRef) : undefined;

    if (!patient || !patientRef) continue;
    const start = appointment.start || '';

    if (!start) continue;

    const locationRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
      ?.reference;

    const location = locationRef ? locationMap.get(locationRef) : undefined;

    const visitType = isTelemedAppointment(appointment)
      ? 'Telemed'
      : isInPersonAppointment(appointment)
      ? 'In-Person'
      : 'Unknown';

    const svcCoding = (appointment.serviceCategory ?? [])
      .flatMap((sc) => sc.coding ?? [])
      .find((c) => c.system === SERVICE_CATEGORY_SYSTEM);

    const serviceCategory = svcCoding?.display || svcCoding?.code || '';
    const encounter = appointment.id ? encounterByApptRef.get(`Appointment/${appointment.id}`) : undefined;
    const provider = encounter ? providerNameForEncounter(encounter) : undefined;

    // Same Ottehr status vocabulary as the Encounters/Billing datasets (completed/pending/…), not
    // the raw FHIR statuses (finished/booked/…) — cross-dataset filters and rollups must agree.
    // When the appointment has no encounter riding along, map through the helper with a stub so
    // the appointment-only statuses (booked → pending, arrived, checked-in → ready) still land in
    // the shared vocabulary.
    const status = getInPersonVisitStatus(
      appointment,
      encounter ?? { resourceType: 'Encounter', status: 'planned', class: { code: 'AMB' } },
      true
    );

    let agg = aggByPatient.get(patientRef);

    if (!agg) {
      agg = {
        patient,
        visitDates: [],
        lastVisitStart: start,
        lastVisitStatus: status,
        visitTypes: new Set(),
        locations: new Set(),
        providers: new Set(),
        serviceCategories: new Set(),
      };
      aggByPatient.set(patientRef, agg);
    }

    agg.visitDates.push(start);

    if (DateTime.fromISO(start) >= DateTime.fromISO(agg.lastVisitStart)) {
      agg.lastVisitStart = start;
      agg.lastVisitStatus = status;
    }

    if (visitType !== 'Unknown') agg.visitTypes.add(visitType);
    if (location?.name) agg.locations.add(location.name);
    if (provider) agg.providers.add(provider);
    if (serviceCategory) agg.serviceCategories.add(serviceCategory);
  }

  // Every requested layer at once, for the patients of the rows.
  const columns = await fetchPatientLayerColumns(oystehr, {
    dateRange,
    patients: Array.from(aggByPatient.values()).map((agg) => agg.patient),
    layerIds: requestedPatientLayers(params),
  });

  const rows: AdHocPatientRow[] = [];

  for (const agg of aggByPatient.values()) {
    const patient = agg.patient;
    const patientRef = `Patient/${patient.id}`;
    const address = getAddressForIndividual(patient);
    const sortedDates = [...agg.visitDates].sort();

    const age = patient.birthDate
      ? Math.floor(DateTime.now().diff(DateTime.fromISO(patient.birthDate), 'years').years)
      : null;

    rows.push({
      patientId: patient.id || '',
      firstName: getPatientFirstName(patient) || '',
      lastName: getPatientLastName(patient) || '',
      patientName: [getPatientFirstName(patient), getPatientLastName(patient)].filter(Boolean).join(' '),
      dateOfBirth: patient.birthDate || null,
      age,
      sex: patient.gender ? mapGenderToLabel[patient.gender] ?? '' : '',
      city: address?.city || '',
      state: address?.state || '',
      zip: address?.postalCode || '',
      phone: getPhoneNumberForIndividual(patient) || '',
      email: getEmailForIndividual(patient) || '',
      source: patient.extension?.find((e) => e.url === PATIENT_POINT_OF_DISCOVERY_URL)?.valueString || '',
      active: patient.active !== false,
      mergedIntoPatientId: getMergedIntoPatientReference(patient)?.replace('Patient/', '') ?? null,
      totalVisits: agg.visitDates.length,
      // RAW ISO instants — the server never zone-formats dates. The client dataset rewrites both
      // to the viewer-local yyyy-MM-dd day in the browser.
      firstVisitDate: sortedDates[0] || '',
      lastVisitDate: agg.lastVisitStart,
      lastVisitStatus: agg.lastVisitStatus,
      visitTypes: [...agg.visitTypes].sort(),
      locations: [...agg.locations].sort(),
      providers: [...agg.providers].sort(),
      serviceCategories: [...agg.serviceCategories].sort(),
      ...columns.get(patientRef),
    });
  }

  return rows;
}
