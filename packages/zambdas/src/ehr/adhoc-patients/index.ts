import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AllergyIntolerance,
  Appointment,
  Condition,
  Encounter,
  EpisodeOfCare,
  Location,
  MedicationStatement,
  Patient,
  Practitioner,
  Procedure,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AdHocPatientRow,
  AdHocPatientsOutput,
  getAddressForIndividual,
  getAttendingPractitionerId,
  getEmailForIndividual,
  getInPersonVisitStatus,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  isInPersonAppointment,
  isTelemedAppointment,
  mapGenderToLabel,
  PATIENT_POINT_OF_DISCOVERY_URL,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { fetchAppointmentReportResources, REPORT_ATTENDED_APPOINTMENT_STATUSES } from '../../shared/adhoc-report';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'adhoc-patients';

// Format visit dates in the practice's zone (matches AdHocReport.tsx on the client); the process
// zone is UTC in prod, which would shift evening visits to the next calendar day.
const REPORT_TIME_ZONE = 'America/New_York';

const hasTag = (resource: { meta?: { tag?: { code?: string }[] } }, code: string): boolean =>
  Boolean(resource.meta?.tag?.some((t) => t.code === code));

const uniq = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

// Per-patient accumulator while we fold the appointment/encounter graph down to one row per patient.
interface PatientAgg {
  patient: Patient;
  visitDates: string[]; // ISO start of each visit in range
  lastVisitStart: string;
  lastVisitStatus: string;
  visitTypes: Set<string>;
  locations: Set<string>;
  providers: Set<string>;
  serviceCategories: Set<string>;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const {
    dateRange,
    includeAllergies,
    includeProblems,
    includeMedications,
    includeSurgicalHistory,
    includeHospitalizations,
    secrets,
  } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  type ReportResource =
    | Appointment
    | Encounter
    | Patient
    | Location
    | Practitioner
    | AllergyIntolerance
    | Condition
    | MedicationStatement
    | Procedure
    | EpisodeOfCare;
  // Shrink the page when patient-bound clinical layers are on (each adds resources per patient and
  // the FHIR server caps response size). Pagination + client-side date batching make up the rest.
  const heavy =
    includeAllergies || includeProblems || includeMedications || includeSurgicalHistory || includeHospitalizations;

  // Anchored on Appointment in the date range (like the Encounters dataset), but folded to one row
  // per patient. Patient-bound clinical layers ride along via patient-scoped revincludes.
  const layerRevincludes: { name: string; value: string }[] = [];
  if (includeAllergies) layerRevincludes.push({ name: '_revinclude:iterate', value: 'AllergyIntolerance:patient' });
  if (includeProblems) layerRevincludes.push({ name: '_revinclude:iterate', value: 'Condition:patient' });
  if (includeMedications) layerRevincludes.push({ name: '_revinclude:iterate', value: 'MedicationStatement:patient' });
  if (includeSurgicalHistory) layerRevincludes.push({ name: '_revinclude:iterate', value: 'Procedure:patient' });
  if (includeHospitalizations) layerRevincludes.push({ name: '_revinclude:iterate', value: 'EpisodeOfCare:patient' });

  // Attended visits only (no cancelled / no-show): unlike the Encounters/Billing datasets, the
  // per-patient rollups (totalVisits, first/lastVisitDate, locations, providers) carry no per-visit
  // status a report could filter on, so cancelled/no-show visits would silently inflate the counts
  // and disagree with the Recent Patients report.
  const allResources = await fetchAppointmentReportResources<ReportResource>(oystehr, {
    dateRange,
    pageSize: heavy ? 400 : 1000,
    extraParams: layerRevincludes,
    statuses: REPORT_ATTENDED_APPOINTMENT_STATUSES,
  });

  const appointmentMap = new Map<string, Appointment>();
  const patientMap = new Map<string, Patient>();
  const locationMap = new Map<string, Location>();
  const encounters: Encounter[] = [];
  // Patient-bound clinical resources, keyed by `Patient/{id}`.
  const allergiesByPatient = new Map<string, AllergyIntolerance[]>();
  const conditionsByPatient = new Map<string, Condition[]>();
  const medsByPatient = new Map<string, MedicationStatement[]>();
  const surgeriesByPatient = new Map<string, Procedure[]>();
  const hospitalizationsByPatient = new Map<string, EpisodeOfCare[]>();

  const pushTo = <T>(map: Map<string, T[]>, key: string | undefined, value: T): void => {
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), value]);
  };

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
      case 'AllergyIntolerance':
        if (includeAllergies && hasTag(r, 'known-allergy')) pushTo(allergiesByPatient, r.patient?.reference, r);
        break;
      case 'Condition':
        if (includeProblems && hasTag(r, 'medical-condition')) pushTo(conditionsByPatient, r.subject?.reference, r);
        break;
      case 'MedicationStatement':
        if (includeMedications && hasTag(r, 'current-medication')) pushTo(medsByPatient, r.subject?.reference, r);
        break;
      case 'Procedure':
        if (includeSurgicalHistory && hasTag(r, 'surgical-history'))
          pushTo(surgeriesByPatient, r.subject?.reference, r);
        break;
      case 'EpisodeOfCare':
        if (includeHospitalizations) pushTo(hospitalizationsByPatient, r.patient?.reference, r);
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

  const ymd = (iso: string): string =>
    iso ? DateTime.fromISO(iso).setZone(REPORT_TIME_ZONE).toFormat('yyyy-MM-dd') : '';

  const rows: AdHocPatientRow[] = [];
  for (const agg of aggByPatient.values()) {
    const patient = agg.patient;
    const patientRef = `Patient/${patient.id}`;
    const address = getAddressForIndividual(patient);
    const sortedDates = [...agg.visitDates].sort();
    const age = patient.birthDate
      ? Math.floor(DateTime.now().diff(DateTime.fromISO(patient.birthDate), 'years').years)
      : null;

    const row: AdHocPatientRow = {
      patientId: patient.id || '',
      firstName: getPatientFirstName(patient) || '',
      lastName: getPatientLastName(patient) || '',
      patientName: `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim(),
      dateOfBirth: patient.birthDate || null,
      age,
      sex: patient.gender ? mapGenderToLabel[patient.gender] ?? '' : '',
      city: address?.city || '',
      state: address?.state || '',
      zip: address?.postalCode || '',
      phone: getPhoneNumberForIndividual(patient) || '',
      email: getEmailForIndividual(patient) || '',
      source: patient.extension?.find((e) => e.url === PATIENT_POINT_OF_DISCOVERY_URL)?.valueString || '',
      totalVisits: agg.visitDates.length,
      firstVisitDate: ymd(sortedDates[0] || ''),
      lastVisitDate: ymd(agg.lastVisitStart),
      lastVisitStatus: agg.lastVisitStatus,
      visitTypes: [...agg.visitTypes].sort(),
      locations: [...agg.locations].sort(),
      providers: [...agg.providers].sort(),
      serviceCategories: [...agg.serviceCategories].sort(),
    };

    if (includeAllergies) {
      const allergies = (allergiesByPatient.get(patientRef) ?? [])
        .map((a) => a.code?.coding?.[0]?.display || a.code?.text || '')
        .filter(Boolean);
      row.allergies = uniq(allergies);
      row.allergyCount = row.allergies.length;
    }
    if (includeProblems) {
      const conditions = conditionsByPatient.get(patientRef) ?? [];
      const problems: string[] = [];
      const problemCodes: string[] = [];
      for (const c of conditions) {
        const codings = c.code?.coding ?? [];
        const icd = codings.find((cd) => cd.system?.toLowerCase().includes('icd-10')) ?? codings[0];
        const display = icd?.display || c.code?.text || '';
        if (display) problems.push(display);
        if (icd?.code) problemCodes.push(icd.code);
      }
      row.problems = uniq(problems);
      row.problemCodes = uniq(problemCodes);
      row.problemCount = row.problems.length;
    }
    if (includeMedications) {
      const meds = (medsByPatient.get(patientRef) ?? [])
        .map((m) => m.medicationCodeableConcept?.coding?.[0]?.display || m.medicationCodeableConcept?.text || '')
        .filter(Boolean);
      row.currentMedications = uniq(meds);
      row.currentMedicationCount = row.currentMedications.length;
    }
    if (includeSurgicalHistory) {
      const surgeries = (surgeriesByPatient.get(patientRef) ?? [])
        .map((p) => p.code?.coding?.[0]?.display || p.code?.text || '')
        .filter(Boolean);
      row.surgicalHistory = uniq(surgeries);
      row.surgicalHistoryCount = row.surgicalHistory.length;
    }
    if (includeHospitalizations) {
      const hosps = (hospitalizationsByPatient.get(patientRef) ?? [])
        .map((e) => e.type?.[0]?.text || e.type?.[0]?.coding?.[0]?.display || '')
        .filter(Boolean);
      row.hospitalizations = uniq(hosps);
      row.hospitalizationCount = row.hospitalizations.length;
    }

    rows.push(row);
  }

  const output: AdHocPatientsOutput = { patients: rows };
  return { statusCode: 200, body: JSON.stringify(output) };
});
