// The patients dataset's layers, one module each, keyed by patient. The same modules give the encounters and
// billing datasets their foreign `patients.*` layers (fetchPatientLayerColumns).
import Oystehr from '@oystehr/sdk';
import {
  AllergyIntolerance,
  Appointment,
  Communication,
  Condition,
  EpisodeOfCare,
  FhirResource,
  MedicationStatement,
  Organization,
  Patient,
  Practitioner,
  Procedure,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FHIR_EXTENSION, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getMiddleName, getNameSuffix, getPronounsFromExtension } from 'utils/lib/fhir/patient';
import { isNoteEdited } from 'utils/lib/helpers/visit-note/note-edit-detection.helper';
import { AdHocPatientRow, PatientLayerId } from 'utils/lib/types/adhoc/datasets/patients';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import {
  PATIENT_HAS_MEDICAID_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL,
  PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL,
} from 'utils/lib/types/constants';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import { InsuranceCheckStatusWithDate } from 'utils/lib/types/data/telemed/eligibility.types';
import { PATIENT_CONTAINED_PHARMACY_ID } from '../../../ehr/shared/harvest';
import { fetchScopedResources, presentFullName } from '../../adhoc-report';
import { mapResourceToChartDataResponse } from '../../chart-data';
import { getOccupationalMedicineEmployerName } from '../../occupational-medicine-employer';
import { composeAttorneyData } from '../../pdf/sections/attorneyInfo';
import { composeEmergencyContactData } from '../../pdf/sections/emergencyContactInfo';
import { composeEmployerData } from '../../pdf/sections/employerInfo';
import { composeInsuranceData } from '../../pdf/sections/insuranceInfo';
import { composePatientDetailsData } from '../../pdf/sections/patientDetails';
import { composePharmacyData } from '../../pdf/sections/pharmacyInfo';
import { composePrimaryCarePhysicianData } from '../../pdf/sections/primaryCarePhysician';
import { composeResponsiblePartyData } from '../../pdf/sections/responsiblePartyInfo';
import { eligibilityCheckFields, indexEligibilityChecks } from '../eligibility-checks';
import { once } from '../memo';
import { fetchPatientAccounts } from '../patient-accounts';

// Both spellings the app has written for the "not listed" pronoun choice.
const PRONOUNS_NOT_LISTED = ['My pronounces are not listed', 'My pronouns are not listed'];

const PATIENT_NOTE_TAG = `${PRIVATE_EXTENSION_BASE_URL}/patient|patient-note`;

const uniq = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const pushTo = <T>(map: Map<string, T[]>, key: string | undefined, value: T): void => {
  if (!key) return;
  map.set(key, [...(map.get(key) ?? []), value]);
};

// An address as the face sheet composers split it, on one line.
export const oneLineAddress = (parts: {
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

export interface PatientLayerContext {
  oystehr: Oystehr;
  dateRange: { start: string; end: string };
  /** The patients the columns are for. */
  patients: Patient[];
  /** `Patient/{id}` of each. */
  refs: string[];
  shared: {
    /** The patient-account page's account / coverage picture, for the contacts, insurance, eligibility and employer layers. */
    accounts(): Promise<Map<string, PatientAccountAndCoverageResources>>;
  };
}

export interface PatientLayerModule<Out> {
  id: PatientLayerId;
  fetch(ctx: PatientLayerContext): Promise<Out>;
  map(patientRef: string, patient: Patient, out: Out): Partial<AdHocPatientRow>;
}

type AnyPatientLayerModule = PatientLayerModule<unknown>;

const definePatientLayer = <Out>(module: PatientLayerModule<Out>): AnyPatientLayerModule =>
  module as unknown as AnyPatientLayerModule;

type ChartListResource = AllergyIntolerance | Condition | MedicationStatement | Procedure | EpisodeOfCare;

/**
 * A chart list of the patients, by the tag chart-data writes it with — only the list resources, not every
 * Condition / Procedure the patient ever had — sorted into the list by the chart's own resource → DTO mapper.
 */
const chartListLayer = (
  id: PatientLayerId,
  resourceType: ChartListResource['resourceType'],
  tags: string,
  columns: (chart: GetChartDataResponse) => Partial<AdHocPatientRow>
): AnyPatientLayerModule =>
  definePatientLayer<Map<string, ChartListResource[]>>({
    id,
    fetch: async (ctx) => {
      const byPatient = new Map<string, ChartListResource[]>();
      for (const r of await fetchScopedResources<ChartListResource>(ctx.oystehr, resourceType, 'patient', ctx.refs, [
        { name: '_tag', value: tags },
      ])) {
        pushTo(byPatient, 'patient' in r ? r.patient?.reference : r.subject?.reference, r);
      }
      return byPatient;
    },
    map: (patientRef, patient, byPatient) => {
      let chart: GetChartDataResponse = {
        patientId: patient.id ?? '',
        allergies: [],
        conditions: [],
        medications: [],
        surgicalHistory: [],
        episodeOfCare: [],
      };
      for (const resource of byPatient.get(patientRef) ?? []) {
        chart = mapResourceToChartDataResponse(chart, resource as FhirResource, '').chartDataResponse;
      }
      return columns(chart);
    },
  });

const allergiesLayer = chartListLayer('allergies', 'AllergyIntolerance', 'known-allergy', (chart) => {
  const allergies = (chart.allergies ?? []).filter((a) => a.name);
  const names = uniq(allergies.map((a) => a.name ?? ''));
  return {
    allergies: names,
    allergyCount: names.length,
    allergyDetails: allergies.map((a) => ({ name: a.name ?? '', current: !!a.current, note: a.note ?? '' })),
  };
});

const problemsLayer = chartListLayer('problems', 'Condition', 'medical-condition', (chart) => {
  const conditions = (chart.conditions ?? []).filter((c) => c.display || c.code);
  // A coded condition without a display still counts, by its code.
  const problems = uniq(conditions.map((c) => c.display || c.code || ''));
  return {
    problems,
    problemCodes: uniq(conditions.map((c) => c.code ?? '')),
    problemCount: problems.length,
    problemDetails: conditions.map((c) => ({
      display: c.display || c.code || '',
      code: c.code ?? '',
      current: !!c.current,
      note: c.note ?? '',
    })),
  };
});

const medicationsLayer = chartListLayer(
  'medications',
  'MedicationStatement',
  'current-medication,prescribed-medication',
  (chart) => {
    const meds = (chart.medications ?? []).filter((m) => m.name);
    const currentMedications = uniq(meds.map((m) => m.name));
    return {
      currentMedications,
      currentMedicationCount: currentMedications.length,
      currentMedicationDetails: meds.map((m) => ({
        name: m.name,
        type: m.type,
        dose: m.intakeInfo.dose ?? '',
        status: m.status,
        lastTakenAt: m.intakeInfo.date ?? null,
      })),
    };
  }
);

const surgicalHistoryLayer = chartListLayer('surgicalHistory', 'Procedure', 'surgical-history', (chart) => {
  const surgeries = chart.surgicalHistory ?? [];
  const surgicalHistory = uniq(surgeries.map((p) => p.display));
  return {
    surgicalHistory,
    surgicalHistoryCount: surgicalHistory.length,
    surgicalHistoryCodes: uniq(surgeries.map((p) => p.code)),
  };
});

const hospitalizationsLayer = chartListLayer('hospitalizations', 'EpisodeOfCare', 'hospitalization', (chart) => {
  const hospitalizations = uniq((chart.episodeOfCare ?? []).map((e) => e.display));
  return { hospitalizations, hospitalizationCount: hospitalizations.length };
});

// The Recent Patients report's new-vs-existing check: any Appointment of the patient before the range start,
// whatever its status or type, makes the patient existing.
const visitHistoryLayer = definePatientLayer<Map<string, string>>({
  id: 'visitHistory',
  fetch: async (ctx) => {
    const lastAppointmentBeforeRange = new Map<string, string>();
    const priorAppointments = await fetchScopedResources<Appointment>(ctx.oystehr, 'Appointment', 'patient', ctx.refs, [
      { name: 'date', value: `lt${ctx.dateRange.start}` },
      { name: '_elements', value: 'id,start,participant' },
    ]);

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
    return lastAppointmentBeforeRange;
  },
  map: (patientRef, _patient, lastAppointmentBeforeRange) => {
    const lastBefore = lastAppointmentBeforeRange.get(patientRef);
    return {
      patientStatus: lastBefore === undefined ? 'new' : 'existing',
      lastAppointmentBeforeRange: lastBefore || null,
    };
  },
});

// The visit details face sheet's composers, fed the way visit-details-to-pdf feeds them: the PCP is the active
// contained Practitioner and the pharmacy the contained Organization with the pharmacy id.
const demographicsLayer = definePatientLayer<null>({
  id: 'demographics',
  fetch: async () => null,
  map: (_patientRef, patient) => {
    const details = composePatientDetailsData({ patient });

    const pcpPractitioner = patient.contained?.find(
      (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.active === true
    );

    const pcp = composePrimaryCarePhysicianData({ physician: pcpPractitioner });

    const pharmacy = composePharmacyData(
      patient.contained?.find(
        (resource): resource is Organization =>
          resource.resourceType === 'Organization' && resource.id === PATIENT_CONTAINED_PHARMACY_ID
      )
    );

    const pronouns = getPronounsFromExtension(patient);
    const customPronouns = patient.extension?.find((e) => e.url === PATIENT_INDIVIDUAL_PRONOUNS_CUSTOM_URL)
      ?.valueString;

    return {
      middleName: (patient.name?.[0] && getMiddleName(patient)) || '',
      nameSuffix: getNameSuffix(patient) ?? '',
      // The street lines as the face sheet's contact composer reads them (patient.address[0].line).
      addressLine1: patient.address?.[0]?.line?.[0] ?? '',
      addressLine2: patient.address?.[0]?.line?.[1] ?? '',
      // As the face sheet's composePatientData reads it (it prints "none" when empty; the dataset keeps "").
      authorizedNonLegalGuardians:
        patient.extension?.find((e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url)?.valueString ??
        '',
      preferredLanguage: details.preferredLanguage,
      race: details.patientsRace,
      ethnicity: details.patientsEthnicity,
      sexualOrientation: details.patientSexualOrientation,
      genderIdentity: details.patientGenderIdentity,
      genderIdentityDetails: details.patientGenderIdentityDetails,
      marketingOptIn: details.patientSendMarketing,
      commonWellConsent: details.patientCommonWellConsent,
      hasPcp: pcp.hasPcp,
      pcpName: presentFullName(pcpPractitioner),
      pcpPracticeName: pcp.pcpPracticeName,
      pcpAddress: pcp.pcpAddress,
      pcpPhone: pcp.pcpPhone,
      pcpFax: pcp.pcpFax,
      preferredPharmacy: pharmacy.name,
      preferredPharmacyAddress: pharmacy.address,
      preferredPharmacyPhone: pharmacy.phone,
      deceased: patient.deceasedBoolean === true || Boolean(patient.deceasedDateTime),
      // Read the way the face sheet (composePatientData / composeContactData) and the payments list read them.
      preferredName: patient.name?.find((name) => name.use === 'nickname')?.given?.[0] ?? '',
      // The chart header's rule (getPronouns): the custom wording replaces the "not listed" choice.
      pronouns: PRONOUNS_NOT_LISTED.includes(pronouns) ? customPronouns ?? '' : pronouns,
      preferredCommunicationMethod:
        patient.extension?.find((e) => e.url === PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL)?.valueString ?? '',
      hasMedicaid: patient.extension?.find((e) => e.url === PATIENT_HAS_MEDICAID_URL)?.valueBoolean ?? false,
    };
  },
});

// The face sheet's responsible-party, emergency-contact and attorney composers.
const contactsLayer = definePatientLayer<Map<string, PatientAccountAndCoverageResources>>({
  id: 'contacts',
  fetch: (ctx) => ctx.shared.accounts(),
  map: (patientRef, _patient, accountsByPatient) => {
    const account = accountsByPatient.get(patientRef);
    const responsibleParty = composeResponsiblePartyData({ guarantorResource: account?.guarantorResource });
    const emergencyContact = composeEmergencyContactData({
      emergencyContactResource: account?.emergencyContactResource,
    });
    const attorney = composeAttorneyData({ attorneyRelatedPerson: account?.attorneyRelatedPerson });

    return {
      responsiblePartyRelationship: responsibleParty.relationship,
      responsiblePartyName: presentFullName(account?.guarantorResource),
      responsiblePartyDateOfBirth: responsibleParty.dob,
      responsiblePartySex: responsibleParty.sex,
      responsiblePartyPhone: responsibleParty.phone,
      responsiblePartyEmail: responsibleParty.email,
      responsiblePartyAddress: oneLineAddress(responsibleParty),
      emergencyContactRelationship: emergencyContact.relationship,
      emergencyContactName: [emergencyContact.firstName, emergencyContact.middleName, emergencyContact.lastName]
        .filter(Boolean)
        .join(' '),
      emergencyContactPhone: emergencyContact.phone,
      emergencyContactAddress: oneLineAddress(emergencyContact),
      hasAttorney: !!account?.attorneyRelatedPerson,
      attorneyFirm: attorney.firm,
      attorneyName: [attorney.firstName, attorney.lastName].filter(Boolean).join(' '),
      attorneyEmail: attorney.email,
      attorneyPhone: attorney.mobile,
      attorneyFax: attorney.fax,
    };
  },
});

const insuranceLayer = definePatientLayer<Map<string, PatientAccountAndCoverageResources>>({
  id: 'insurance',
  fetch: (ctx) => ctx.shared.accounts(),
  map: (patientRef, _patient, accountsByPatient) => {
    const account = accountsByPatient.get(patientRef);
    const insurance = composeInsuranceData({
      coverages: account?.coverages ?? {},
      insuranceOrgs: account?.insuranceOrgs ?? [],
    });

    return {
      insured: !!account?.coverages.primary,
      primaryInsuranceCarrier: insurance.primary.insuranceCarrier,
      primaryPlanType: insurance.primary.planType,
      primaryMemberId: insurance.primary.memberId,
      primaryRelationshipToInsured: insurance.primary.relationship,
      primaryPolicyHolderName: presentFullName(account?.coverages.primarySubscriber),
      primaryPolicyHolderDateOfBirth: insurance.primary.policyHoldersDateOfBirth,
      primaryPolicyHolderSex: insurance.primary.policyHoldersSex,
      primaryPolicyHolderAddress: oneLineAddress(insurance.primary),
      primaryInsuranceAdditionalInformation: insurance.primary.additionalInformation,
      secondaryInsuranceCarrier: insurance.secondary.insuranceCarrier,
      secondaryPlanType: insurance.secondary.planType,
      secondaryMemberId: insurance.secondary.memberId,
      secondaryRelationshipToInsured: insurance.secondary.relationship,
      secondaryPolicyHolderName: presentFullName(account?.coverages.secondarySubscriber),
      secondaryPolicyHolderDateOfBirth: insurance.secondary.policyHoldersDateOfBirth,
      secondaryPolicyHolderSex: insurance.secondary.policyHoldersSex,
      secondaryPolicyHolderAddress: oneLineAddress(insurance.secondary),
      secondaryInsuranceAdditionalInformation: insurance.secondary.additionalInformation,
    };
  },
});

interface EligibilityOut {
  latestCheckIds: Map<string, { primary?: string; secondary?: string }>;
  checks: Map<string, InsuranceCheckStatusWithDate>;
}

const eligibilityLayer = definePatientLayer<EligibilityOut>({
  id: 'eligibility',
  fetch: async (ctx) => {
    const latestCheckIds = new Map<string, { primary?: string; secondary?: string }>();
    if (!ctx.refs.length) return { latestCheckIds, checks: new Map() };

    const [accountsByPatient, eligibility] = await Promise.all([
      ctx.shared.accounts(),
      indexEligibilityChecks(ctx.oystehr, ctx.refs),
    ]);

    for (const patientRef of ctx.refs) {
      const coverages = accountsByPatient.get(patientRef)?.coverages;

      latestCheckIds.set(patientRef, {
        primary: eligibility.latestCheckId(patientRef, coverages?.primary),
        secondary: eligibility.latestCheckId(patientRef, coverages?.secondary),
      });
    }

    const checks = await eligibility.load(
      Array.from(latestCheckIds.values()).flatMap(({ primary, secondary }) =>
        [primary, secondary].filter((id): id is string => !!id)
      )
    );

    return { latestCheckIds, checks };
  },
  map: (patientRef, _patient, { latestCheckIds, checks }) => {
    const checkIds = latestCheckIds.get(patientRef);
    const primaryCheck = eligibilityCheckFields(checkIds?.primary ? checks.get(checkIds.primary) : undefined);
    const secondaryCheck = eligibilityCheckFields(checkIds?.secondary ? checks.get(checkIds.secondary) : undefined);

    return {
      primaryEligibilityStatus: primaryCheck.status,
      primaryEligibilityCheckedAt: primaryCheck.checkedAt,
      secondaryEligibilityStatus: secondaryCheck.status,
      secondaryEligibilityCheckedAt: secondaryCheck.checkedAt,
    };
  },
});

const employersLayer = definePatientLayer<Map<string, PatientAccountAndCoverageResources>>({
  id: 'employers',
  fetch: (ctx) => ctx.shared.accounts(),
  map: (patientRef, _patient, accountsByPatient) => {
    const account = accountsByPatient.get(patientRef);
    const workersComp = composeEmployerData({
      employer: account?.employerOrganization,
      workersCompCoverage: account?.coverages.workersComp,
      insuranceOrgs: account?.insuranceOrgs,
    });

    return {
      occupationalMedicineEmployer:
        getOccupationalMedicineEmployerName({
          occupationalMedicineEmployerOrganization: account?.occupationalMedicineEmployerOrganization,
          occupationalMedicineAccount: account?.occupationalMedicineAccount,
        }) ?? '',
      workersCompEmployer: workersComp.employerName,
      workersCompEmployerAddress: oneLineAddress(workersComp),
      workersCompEmployerContactName: [workersComp.firstName, workersComp.lastName].filter(Boolean).join(' '),
      workersCompEmployerContactTitle: workersComp.title,
      workersCompEmployerContactEmail: workersComp.email,
      workersCompEmployerContactPhone: workersComp.phone,
      workersCompEmployerContactFax: workersComp.fax,
      workersCompCarrier: workersComp.workersCompInsuranceCarrier,
      workersCompMemberId: workersComp.workersCompMemberId,
    };
  },
});

// The patient page's notes (get-patient-notes): completed patient-note Communications, newest first.
const notesLayer = definePatientLayer<Map<string, Communication[]>>({
  id: 'notes',
  fetch: async (ctx) => {
    const byPatient = new Map<string, Communication[]>();
    const notes = await fetchScopedResources<Communication>(ctx.oystehr, 'Communication', 'subject', ctx.refs, [
      { name: '_tag', value: PATIENT_NOTE_TAG },
      { name: 'status', value: 'completed' },
    ]);
    for (const note of notes) pushTo(byPatient, note.subject?.reference, note);
    return byPatient;
  },
  map: (patientRef, _patient, byPatient) => {
    // Mapped as get-patient-notes maps them, newest first.
    const notes = [...(byPatient.get(patientRef) ?? [])].sort((a, b) =>
      (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? '')
    );

    const patientNotes = notes.map((note) => ({
      text: note.payload?.[0]?.contentString ?? '',
      author: note.sender?.display ?? '',
      addedAt: note.meta?.lastUpdated || null,
      edited: isNoteEdited(note.sent, note.meta?.lastUpdated),
    }));

    return { patientNotes, patientNoteCount: patientNotes.length };
  },
});

/** Every layer module of the patients dataset, by layer id. */
export const PATIENT_LAYER_MODULES: Record<PatientLayerId, AnyPatientLayerModule> = {
  allergies: allergiesLayer,
  problems: problemsLayer,
  medications: medicationsLayer,
  surgicalHistory: surgicalHistoryLayer,
  visitHistory: visitHistoryLayer,
  demographics: demographicsLayer,
  contacts: contactsLayer,
  insurance: insuranceLayer,
  eligibility: eligibilityLayer,
  employers: employersLayer,
  hospitalizations: hospitalizationsLayer,
  notes: notesLayer,
};

/**
 * The columns of the given patient layers for the given patients, keyed `Patient/{id}`. The layers load at
 * once; the account picture is loaded once for all the layers that read it.
 */
export async function fetchPatientLayerColumns(
  oystehr: Oystehr,
  params: { dateRange: { start: string; end: string }; patients: Patient[]; layerIds: PatientLayerId[] }
): Promise<Map<string, Partial<AdHocPatientRow>>> {
  const patients = params.patients.filter((p) => p.id);
  const ctx: PatientLayerContext = {
    oystehr,
    dateRange: params.dateRange,
    patients,
    refs: patients.map((p) => `Patient/${p.id}`),
    shared: { accounts: once(() => fetchPatientAccounts(oystehr, patients)) },
  };

  const modules = params.layerIds.map((id) => PATIENT_LAYER_MODULES[id]);
  const outs = await Promise.all(modules.map((module) => module.fetch(ctx)));

  const columns = new Map<string, Partial<AdHocPatientRow>>();
  for (const patient of patients) {
    const patientRef = `Patient/${patient.id}`;
    const row: Partial<AdHocPatientRow> = {};
    modules.forEach((module, index) => Object.assign(row, module.map(patientRef, patient, outs[index])));
    columns.set(patientRef, row);
  }
  return columns;
}
