import Oystehr from '@oystehr/sdk';
import {
  AllergyIntolerance,
  Appointment,
  Communication,
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
import { FHIR_EXTENSION, PRIVATE_EXTENSION_BASE_URL, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import {
  getAddressForIndividual,
  getEmailForIndividual,
  getMergedIntoPatientReference,
  getMiddleName,
  getNameSuffix,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  getPronounsFromExtension,
  mapGenderToLabel,
} from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { AdHocPatientRow, AdHocPatientsInput } from 'utils/lib/types/adhoc/datasets/patients';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import {
  PATIENT_HAS_MEDICAID_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL,
  PATIENT_POINT_OF_DISCOVERY_URL,
  PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL,
} from 'utils/lib/types/constants';
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
import { composeAttorneyData } from '../pdf/sections/attorneyInfo';
import { composeEmergencyContactData } from '../pdf/sections/emergencyContactInfo';
import { composeEmployerData } from '../pdf/sections/employerInfo';
import { composeInsuranceData } from '../pdf/sections/insuranceInfo';
import { composePatientDetailsData } from '../pdf/sections/patientDetails';
import { composePharmacyData } from '../pdf/sections/pharmacyInfo';
import { composePrimaryCarePhysicianData } from '../pdf/sections/primaryCarePhysician';
import { composeResponsiblePartyData } from '../pdf/sections/responsiblePartyInfo';
import { fetchPatientAccounts } from './patient-accounts';

// Both spellings the app has written for the "not listed" pronoun choice.
const PRONOUNS_NOT_LISTED = ['My pronounces are not listed', 'My pronouns are not listed'];

const uniq = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

// The patient page's notes tag (get-patient-notes).
const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;

// An address as the face sheet composers split it, on one line.
const oneLineAddress = (parts: {
  streetAddress: string;
  addressLineOptional: string;
  city: string;
  state: string;
  zip: string;
}): string =>
  [
    [parts.streetAddress, parts.addressLineOptional].filter(Boolean).join(' '),
    parts.city,
    [parts.state, parts.zip].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

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
    includeNotes,
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
  // per patient. The main search stays light; the chart lists are loaded afterwards per patient.
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
    }
  }

  // The chart lists of the patients, by the tags chart-data writes them with (the chart's mapper then sorts
  // them into lists) — only the list resources, not every Condition / Procedure the patient ever had.
  const patientRefs = Array.from(patientMap.keys());

  type ChartListResource = AllergyIntolerance | Condition | MedicationStatement | Procedure | EpisodeOfCare;

  const chartListSearches: [ChartListResource['resourceType'], string, boolean][] = [
    ['AllergyIntolerance', 'known-allergy', !!includeAllergies],
    ['Condition', 'medical-condition', !!includeProblems],
    ['MedicationStatement', 'current-medication,prescribed-medication', !!includeMedications],
    ['Procedure', 'surgical-history', !!includeSurgicalHistory],
    ['EpisodeOfCare', 'hospitalization', !!includeHospitalizations],
  ];

  for (const [resourceType, tags, included] of chartListSearches) {
    if (!included || !patientRefs.length) continue;

    const resources = await fetchScopedResources<ChartListResource>(oystehr, resourceType, 'patient', patientRefs, [
      { name: '_tag', value: tags },
    ]);

    for (const r of resources) {
      const patientRef = 'patient' in r ? r.patient?.reference : r.subject?.reference;
      pushTo(chartResourcesByPatient, patientRef, r);
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

      // Compared as instants, not strings — starts are stored with varying UTC offsets.
      if (latest === undefined || DateTime.fromISO(start) > DateTime.fromISO(latest)) {
        lastAppointmentBeforeRange.set(patientRef, start);
      }
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

  // The patient page's notes (get-patient-notes): completed patient-note Communications, newest first.
  const patientNotesByPatient = new Map<string, Communication[]>();

  if (includeNotes && aggByPatient.size) {
    const notes = await fetchScopedResources<Communication>(
      oystehr,
      'Communication',
      'subject',
      Array.from(aggByPatient.keys()),
      [
        { name: '_tag', value: PATIENT_NOTE_TAG },
        { name: 'status', value: 'completed' },
      ]
    );

    for (const note of notes) pushTo(patientNotesByPatient, note.subject?.reference, note);
  }

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
      row.allergyDetails = allergies.map((a) => ({ name: a.name ?? '', current: !!a.current, note: a.note ?? '' }));
    }

    if (includeProblems) {
      const conditions = (chart.conditions ?? []).filter((c) => c.display || c.code);

      // A coded condition without a display still counts, by its code.
      row.problems = uniq(conditions.map((c) => c.display || c.code || ''));

      row.problemCodes = uniq(conditions.map((c) => c.code ?? ''));
      row.problemCount = row.problems.length;

      row.problemDetails = conditions.map((c) => ({
        display: c.display || c.code || '',
        code: c.code ?? '',
        current: !!c.current,
        note: c.note ?? '',
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

      row.middleName = getMiddleName(patient) ?? '';
      row.nameSuffix = getNameSuffix(patient) ?? '';

      // The street lines as the face sheet's contact composer reads them (patient.address[0].line).
      row.addressLine1 = patient.address?.[0]?.line?.[0] ?? '';

      row.addressLine2 = patient.address?.[0]?.line?.[1] ?? '';

      // As the face sheet's composePatientData reads it (it prints "none" when empty; the dataset keeps "").
      row.authorizedNonLegalGuardians =
        patient.extension?.find((e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url)?.valueString ??
        '';

      row.preferredLanguage = details.preferredLanguage;
      row.race = details.patientsRace;
      row.ethnicity = details.patientsEthnicity;
      row.sexualOrientation = details.patientSexualOrientation;
      row.genderIdentity = details.patientGenderIdentity;
      row.genderIdentityDetails = details.patientGenderIdentityDetails;
      row.marketingOptIn = details.patientSendMarketing;
      row.commonWellConsent = details.patientCommonWellConsent;
      row.hasPcp = pcp.hasPcp;
      row.pcpName = pcp.pcpName;
      row.pcpPracticeName = pcp.pcpPracticeName;
      row.pcpAddress = pcp.pcpAddress;
      row.pcpPhone = pcp.pcpPhone;
      row.pcpFax = pcp.pcpFax;
      row.preferredPharmacy = pharmacy.name;
      row.preferredPharmacyAddress = pharmacy.address;
      row.preferredPharmacyPhone = pharmacy.phone;
      row.deceased = patient.deceasedBoolean === true || Boolean(patient.deceasedDateTime);
      // Read the way the face sheet (composePatientData / composeContactData) and the payments list read them.
      row.preferredName = patient.name?.find((name) => name.use === 'nickname')?.given?.[0] ?? '';
      const pronouns = getPronounsFromExtension(patient);
      const customPronouns = patient.extension?.find((e) => e.url === PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL)
        ?.valueString;
      // The chart header's rule (getPronouns): the custom wording replaces the "not listed" choice.
      row.pronouns = PRONOUNS_NOT_LISTED.includes(pronouns) ? customPronouns ?? '' : pronouns;
      row.preferredCommunicationMethod =
        patient.extension?.find((e) => e.url === PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL)?.valueString ?? '';
      row.hasMedicaid = patient.extension?.find((e) => e.url === PATIENT_HAS_MEDICAID_URL)?.valueBoolean ?? false;
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
      row.responsiblePartyDateOfBirth = responsibleParty.dob;
      row.responsiblePartySex = responsibleParty.sex;
      row.responsiblePartyPhone = responsibleParty.phone;
      row.responsiblePartyEmail = responsibleParty.email;
      row.responsiblePartyAddress = oneLineAddress(responsibleParty);
      row.emergencyContactRelationship = emergencyContact.relationship;

      row.emergencyContactName = [emergencyContact.firstName, emergencyContact.middleName, emergencyContact.lastName]
        .filter(Boolean)
        .join(' ');

      row.emergencyContactPhone = emergencyContact.phone;
      row.emergencyContactAddress = oneLineAddress(emergencyContact);

      // The face sheet's attorney composer.
      const attorney = composeAttorneyData({ attorneyRelatedPerson: account?.attorneyRelatedPerson });

      row.hasAttorney = !!account?.attorneyRelatedPerson;
      row.attorneyFirm = attorney.firm;
      row.attorneyName = [attorney.firstName, attorney.lastName].filter(Boolean).join(' ');
      row.attorneyEmail = attorney.email;
      row.attorneyPhone = attorney.mobile;
      row.attorneyFax = attorney.fax;
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
      row.primaryPolicyHolderName = insurance.primary.policyHoldersName;
      row.primaryPolicyHolderDateOfBirth = insurance.primary.policyHoldersDateOfBirth;
      row.primaryPolicyHolderSex = insurance.primary.policyHoldersSex;
      row.primaryPolicyHolderAddress = oneLineAddress(insurance.primary);
      row.primaryInsuranceAdditionalInformation = insurance.primary.additionalInformation;
      row.secondaryInsuranceCarrier = insurance.secondary.insuranceCarrier;
      row.secondaryPlanType = insurance.secondary.planType;
      row.secondaryMemberId = insurance.secondary.memberId;
      row.secondaryRelationshipToInsured = insurance.secondary.relationship;
      row.secondaryPolicyHolderName = insurance.secondary.policyHoldersName;
      row.secondaryPolicyHolderDateOfBirth = insurance.secondary.policyHoldersDateOfBirth;
      row.secondaryPolicyHolderSex = insurance.secondary.policyHoldersSex;
      row.secondaryPolicyHolderAddress = oneLineAddress(insurance.secondary);
      row.secondaryInsuranceAdditionalInformation = insurance.secondary.additionalInformation;
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
      row.workersCompEmployerAddress = oneLineAddress(workersComp);
      row.workersCompEmployerContactName = [workersComp.firstName, workersComp.lastName].filter(Boolean).join(' ');
      row.workersCompEmployerContactTitle = workersComp.title;
      row.workersCompEmployerContactEmail = workersComp.email;
      row.workersCompEmployerContactPhone = workersComp.phone;
      row.workersCompEmployerContactFax = workersComp.fax;
      row.workersCompCarrier = workersComp.workersCompInsuranceCarrier;
      row.workersCompMemberId = workersComp.workersCompMemberId;
    }

    if (includeNotes) {
      // Mapped as get-patient-notes maps them, newest first.
      const notes = [...(patientNotesByPatient.get(patientRef) ?? [])].sort((a, b) =>
        (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? '')
      );

      row.patientNotes = notes.map((note) => ({
        text: note.payload?.[0]?.contentString ?? '',
        author: note.sender?.display ?? '',
        addedAt: note.meta?.lastUpdated || null,
        edited: isNoteEdited(note.sent, note.meta?.lastUpdated),
      }));

      row.patientNoteCount = row.patientNotes.length;
    }

    rows.push(row);
  }

  return rows;
}
