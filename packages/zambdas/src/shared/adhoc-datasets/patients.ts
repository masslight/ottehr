import Oystehr from '@oystehr/sdk';
import {
  AllergyIntolerance,
  Appointment,
  Condition,
  Encounter,
  EpisodeOfCare,
  FhirResource,
  Location,
  MedicationStatement,
  Organization,
  Patient,
  Practitioner,
  Procedure,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
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
import { AdHocPatientRow, AdHocPatientsInput } from 'utils/lib/types/adhoc/datasets/patients';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { PATIENT_POINT_OF_DISCOVERY_URL } from 'utils/lib/types/constants';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { PATIENT_CONTAINED_PHARMACY_ID } from '../../ehr/shared/harvest';
import {
  fetchAppointmentReportResources,
  fetchScopedResources,
  REPORT_ATTENDED_APPOINTMENT_STATUSES,
} from '../adhoc-report';
import { mapResourceToChartDataResponse } from '../chart-data';
import { getOccupationalMedicineEmployerName } from '../occupational-medicine-employer';
import { composeEmergencyContactData } from '../pdf/sections/emergencyContactInfo';
import { composeEmployerData } from '../pdf/sections/employerInfo';
import { composeInsuranceData } from '../pdf/sections/insuranceInfo';
import { composePatientDetailsData } from '../pdf/sections/patientDetails';
import { composePharmacyData } from '../pdf/sections/pharmacyInfo';
import { composePrimaryCarePhysicianData } from '../pdf/sections/primaryCarePhysician';
import { composeResponsiblePartyData } from '../pdf/sections/responsiblePartyInfo';
import { fetchPatientAccounts } from './patient-accounts';

const uniq = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

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

// The full fetch+map pipeline, separated from auth/transport so fixture tests can run it against a
// stubbed Oystehr client and assert the mapped rows parse with the endpoint's Zod schema — the same
// schema the runtime output validation uses.
export async function fetchAdHocPatientRows(oystehr: Oystehr, params: AdHocPatientsInput): Promise<AdHocPatientRow[]> {
  const {
    dateRange,
    includeAllergies,
    includeProblems,
    includeMedications,
    includeSurgicalHistory,
    includeHospitalizations,
    includeVisitHistory,
    includeDemographics,
    includeContacts,
    includeInsurance,
    includeEmployers,
  } = params;

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
    extraParams: layerRevincludes,
    statuses: REPORT_ATTENDED_APPOINTMENT_STATUSES,
  });

  const appointmentMap = new Map<string, Appointment>();
  const patientMap = new Map<string, Patient>();
  const locationMap = new Map<string, Location>();
  const encounters: Encounter[] = [];
  // Patient-bound clinical resources, keyed by `Patient/{id}`; sorted into chart fields by the chart's mapper.
  const chartResourcesByPatient = new Map<string, FhirResource[]>();

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
      case 'EpisodeOfCare':
        pushTo(chartResourcesByPatient, r.patient?.reference, r);
        break;
      case 'Condition':
      case 'MedicationStatement':
      case 'Procedure':
        pushTo(chartResourcesByPatient, r.subject?.reference, r);
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

  // The Recent Patients report's new-vs-existing check: any Appointment of the patient before the range
  // start, whatever its status or type, makes the patient existing.
  const lastAppointmentBeforeRange = new Map<string, string>();
  if (includeVisitHistory && aggByPatient.size) {
    const priorAppointments = await fetchScopedResources<Appointment>(
      oystehr,
      'Appointment',
      'patient',
      Array.from(aggByPatient.keys()),
      [
        { name: 'date', value: `lt${dateRange.start}` },
        { name: '_elements', value: 'id,start,participant' },
      ]
    );

    for (const prior of priorAppointments) {
      const patientRef = prior.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
      if (!patientRef) continue;
      const latest = lastAppointmentBeforeRange.get(patientRef);
      const start = prior.start ?? '';
      if (latest === undefined || start > latest) lastAppointmentBeforeRange.set(patientRef, start);
    }
  }

  // The patient-account page's account / coverage picture, for the contacts, insurance and employer layers.
  const accountsByPatient =
    includeContacts || includeInsurance || includeEmployers
      ? await fetchPatientAccounts(
          oystehr,
          Array.from(aggByPatient.values()).map((agg) => agg.patient)
        )
      : new Map<string, PatientAccountAndCoverageResources>();

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
    };

    // The patient's chart lists, built by the chart's own resource → DTO mapper (the tags it reads decide
    // which list a resource belongs to).
    let chart: GetChartDataResponse = {
      patientId: patient.id ?? '',
      allergies: [],
      conditions: [],
      medications: [],
      surgicalHistory: [],
      episodeOfCare: [],
    };

    for (const resource of chartResourcesByPatient.get(patientRef) ?? []) {
      chart = mapResourceToChartDataResponse(chart, resource, '').chartDataResponse;
    }

    if (includeAllergies) {
      const allergies = (chart.allergies ?? []).filter((a) => a.name);
      row.allergies = uniq(allergies.map((a) => a.name ?? ''));
      row.allergyCount = row.allergies.length;
      row.allergyDetails = allergies.map((a) => ({ name: a.name ?? '', current: !!a.current }));
    }
    if (includeProblems) {
      const conditions = (chart.conditions ?? []).filter((c) => c.display || c.code);
      row.problems = uniq(conditions.map((c) => c.display ?? ''));
      row.problemCodes = uniq(conditions.map((c) => c.code ?? ''));
      row.problemCount = row.problems.length;

      row.problemDetails = conditions.map((c) => ({
        display: c.display ?? '',
        code: c.code ?? '',
        current: !!c.current,
      }));
    }
    if (includeMedications) {
      const meds = (chart.medications ?? []).filter((m) => m.name);
      row.currentMedications = uniq(meds.map((m) => m.name));
      row.currentMedicationCount = row.currentMedications.length;

      row.currentMedicationDetails = meds.map((m) => ({
        name: m.name,
        type: m.type,
        dose: m.intakeInfo.dose ?? '',
        status: m.status,
        lastTakenAt: m.intakeInfo.date ?? null,
      }));
    }

    if (includeSurgicalHistory) {
      const surgeries = chart.surgicalHistory ?? [];
      row.surgicalHistory = uniq(surgeries.map((p) => p.display));
      row.surgicalHistoryCount = row.surgicalHistory.length;
      row.surgicalHistoryCodes = uniq(surgeries.map((p) => p.code));
    }

    if (includeHospitalizations) {
      row.hospitalizations = uniq((chart.episodeOfCare ?? []).map((e) => e.display));
      row.hospitalizationCount = row.hospitalizations.length;
    }

    if (includeVisitHistory) {
      const lastBefore = lastAppointmentBeforeRange.get(patientRef);
      row.patientStatus = lastBefore === undefined ? 'new' : 'existing';
      row.lastAppointmentBeforeRange = lastBefore || null;
    }

    if (includeDemographics) {
      // The visit details face sheet's composers, fed the way visit-details-to-pdf feeds them: the PCP is the
      // active contained Practitioner and the pharmacy the contained Organization with the pharmacy id.
      const details = composePatientDetailsData({ patient });

      const pcp = composePrimaryCarePhysicianData({
        physician: patient.contained?.find(
          (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.active === true
        ),
      });

      const pharmacy = composePharmacyData(
        patient.contained?.find(
          (resource): resource is Organization =>
            resource.resourceType === 'Organization' && resource.id === PATIENT_CONTAINED_PHARMACY_ID
        )
      );

      row.preferredLanguage = details.preferredLanguage;
      row.race = details.patientsRace;
      row.ethnicity = details.patientsEthnicity;
      row.sexualOrientation = details.patientSexualOrientation;
      row.genderIdentity = details.patientGenderIdentity;
      row.marketingOptIn = details.patientSendMarketing;
      row.commonWellConsent = details.patientCommonWellConsent;
      row.hasPcp = pcp.hasPcp;
      row.pcpName = pcp.pcpName;
      row.pcpPracticeName = pcp.pcpPracticeName;
      row.preferredPharmacy = pharmacy.name;
      row.deceased = patient.deceasedBoolean === true || Boolean(patient.deceasedDateTime);
    }

    const account = accountsByPatient.get(patientRef);
    if (includeContacts) {
      // The face sheet's responsible-party and emergency-contact composers.
      const responsibleParty = composeResponsiblePartyData({ guarantorResource: account?.guarantorResource });

      const emergencyContact = composeEmergencyContactData({
        emergencyContactResource: account?.emergencyContactResource,
      });

      row.responsiblePartyRelationship = responsibleParty.relationship;
      row.responsiblePartyName = responsibleParty.fullName;
      row.emergencyContactRelationship = emergencyContact.relationship;

      row.emergencyContactName = [emergencyContact.firstName, emergencyContact.middleName, emergencyContact.lastName]
        .filter(Boolean)
        .join(' ');
    }

    if (includeInsurance) {
      const insurance = composeInsuranceData({
        coverages: account?.coverages ?? {},
        insuranceOrgs: account?.insuranceOrgs ?? [],
      });

      row.insured = !!account?.coverages.primary;
      row.primaryInsuranceCarrier = insurance.primary.insuranceCarrier;
      row.primaryPlanType = insurance.primary.planType;
      row.primaryMemberId = insurance.primary.memberId;
      row.primaryRelationshipToInsured = insurance.primary.relationship;
      row.secondaryInsuranceCarrier = insurance.secondary.insuranceCarrier;
      row.secondaryPlanType = insurance.secondary.planType;
      row.secondaryMemberId = insurance.secondary.memberId;
    }

    if (includeEmployers) {
      const workersComp = composeEmployerData({
        employer: account?.employerOrganization,
        workersCompCoverage: account?.coverages.workersComp,
        insuranceOrgs: account?.insuranceOrgs,
      });

      row.occupationalMedicineEmployer =
        getOccupationalMedicineEmployerName({
          occupationalMedicineEmployerOrganization: account?.occupationalMedicineEmployerOrganization,
          occupationalMedicineAccount: account?.occupationalMedicineAccount,
        }) ?? '';

      row.workersCompEmployer = workersComp.employerName;
      row.workersCompCarrier = workersComp.workersCompInsuranceCarrier;
    }

    rows.push(row);
  }

  return rows;
}
