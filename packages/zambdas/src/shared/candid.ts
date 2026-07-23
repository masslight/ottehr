import Oystehr from '@oystehr/sdk';
// cSpell:ignore Providerid
import { CandidApi, CandidApiClient } from 'candidhealth';
import {
  AppointmentId as CandidAppointmentId,
  Decimal,
  DiagnosisCreate,
  DiagnosisTypeCode,
  EncounterExternalId,
  FacilityTypeCode,
  Gender,
  PatientExternalId,
  PreEncounterAppointmentId,
  PreEncounterPatientId,
  ProcedureModifier,
  ServiceLineUnits,
  State,
  TagId,
} from 'candidhealth/api';
import { RenderingProviderid } from 'candidhealth/api/resources/contracts/resources/v2';
import {
  BillableStatusType,
  EncounterCreateFromPreEncounter,
  ResponsiblePartyType,
} from 'candidhealth/api/resources/encounters/resources/v4';
import {
  AddressUse,
  AppointmentId as CandidPreEncounterAppointmentId,
  CanonicalNonInsurancePayerId,
  ContactPointUse,
  NameUse,
  PatientId,
  PayerId,
  Relationship,
} from 'candidhealth/api/resources/preEncounter';
import { Appointment as CandidPreEncounterAppointment } from 'candidhealth/api/resources/preEncounter/resources/appointments/resources/v1';
import { Sex } from 'candidhealth/api/resources/preEncounter/resources/common/types/Sex';
import { Coverage as CandidPreEncounterCoverage } from 'candidhealth/api/resources/preEncounter/resources/coverages/resources/v1/types/Coverage';
import { MutableCoverage } from 'candidhealth/api/resources/preEncounter/resources/coverages/resources/v1/types/MutableCoverage';
import { Patient as CandidPreEncounterPatient } from 'candidhealth/api/resources/preEncounter/resources/patients/resources/v1/types/Patient';
import { RelatedCausesCode, RelatedCausesInformation } from 'candidhealth/api/resources/relatedCauses/resources/v1';
import {
  DrugIdentification,
  MeasurementUnitCode,
  ServiceIdQualifier,
  ServiceLineCreate,
} from 'candidhealth/api/resources/serviceLines/resources/v2';
import { APIResponse } from 'candidhealth/core';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Condition,
  Coverage,
  Encounter,
  EncounterDiagnosis,
  Extension,
  Identifier,
  Location,
  MedicationAdministration,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ACCIDENT_STATE_EXTENSION,
  ACCIDENT_TYPE_SYSTEM,
  createReference,
  EmCodeOption,
  FHIR_IDENTIFIER_NPI,
  findOrgMatchingReference,
  getAttendingPractitionerId,
  getCandidPlanTypeCodeFromCoverage,
  getCptCodesFromMA,
  getDosageFromMA,
  getEmCodes,
  getMedicationFromMA,
  getNdcCodeFromMedication,
  getPayerId,
  getPayerUrl,
  getPaymentVariantFromEncounter,
  getTimezone,
  INVALID_INPUT_ERROR,
  isAppointmentAutoAccident,
  isAppointmentOccupationalMedicine,
  isAppointmentPreOp,
  isAppointmentWorkersComp,
  isTelemedAppointment,
  MedicationUnitOptions,
  MISSING_PATIENT_COVERAGE_INFO_ERROR,
  OrderedCoveragesWithSubscribers,
  PaymentVariant,
  Secrets,
  TIMEZONES,
} from 'utils';
import {
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_CPT_MODIFIER,
  EXTENSION_URL_CPT_MODIFIER,
} from 'utils/lib/helpers/rcm';
import { getAccountAndCoverageResourcesForPatient } from '../ehr/shared/harvest';
import { chartDataResourceHasMetaTagByCode } from './chart-data';
import { assertDefined } from './helpers';
import { FullAppointmentResourcePackage } from './pdf/visit-details-pdf/types';

export const CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM =
  'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id';

export const CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM =
  'https://pre-api.joincandidhealth.com/appointments/v1/response/appointment_id';

export const CANDID_PATIENT_ID_IDENTIFIER_SYSTEM =
  'https://api.joincandidhealth.com/api/patients/v4/response/patient_id';

export const CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM =
  'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id';

const CANDID_TAG_WORKERS_COMP = 'workers-comp';
const CANDID_TAG_OCCUPATIONAL_MEDICINE = 'occupational-medicine';
const CANDID_TAG_AUTO_ACCIDENT = 'auto-accident';
const CANDID_TAG_PRE_OP = 'pre-op';

// Sent as both the payer name and payer id (with a space, as required by Candid) whenever billing
// should bypass insurance and use a single Cash Pay coverage (employer-paid and self-pay visits).
const CANDID_CASH_PAY_PAYER = 'Cash Pay';

/**
 * Whether the claim should bill a single "Cash Pay" payer instead of insurance. This is true for
 * self-pay visits, and for employer-paid visits only when the visit is occupational medicine. The
 * payment variant comes from the encounter (the authoritative billing signal chosen during paperwork).
 * Note an occupational-medicine *service category* visit can still be insurance-pay, so the service
 * category must not be used on its own to make this decision; it only gates the employer variant.
 *
 * WC visits always use their WC insurance coverage regardless of the payment variant. A WC patient
 * without general insurance may select "I will pay without insurance" on the payment page (which sets
 * paymentVariant = selfPay), but the WC insurer — not Cash Pay — is the correct billing vehicle.
 */
const shouldUseCashPayCoverage = (encounter: Encounter, appointment: Appointment): boolean => {
  if (isAppointmentWorkersComp(appointment)) {
    return false;
  }
  const paymentVariant = getPaymentVariantFromEncounter(encounter);
  if (paymentVariant === PaymentVariant.selfPay) {
    return true;
  }
  if (paymentVariant === PaymentVariant.employer) {
    return isAppointmentOccupationalMedicine(appointment);
  }
  return false;
};

interface BillingProviderData {
  organizationName?: string;
  firstName?: string;
  lastName?: string;
  npi: string;
  taxId: string;
  addressLine: string;
  city: string;
  state: string;
  zipCode: string;
  zipPlusFourCode: string;
}

interface InsuranceResources {
  coverage: Coverage;
  subscriber: Patient | RelatedPerson;
  payor: Organization;
}

interface CreateEncounterInput {
  appointment: Appointment;
  location: Location | undefined;
  encounter: Encounter;
  patient: Patient;
  practitioner: Practitioner;
  diagnoses: Condition[];
  procedures: Procedure[];
  medicationAdministrations: MedicationAdministration[];
  insuranceResources?: InsuranceResources;
  accident?: Condition;
  emCodes: EmCodeOption[];
}

const STUB_BILLING_PROVIDER_DATA: BillingProviderData = {
  organizationName: 'StubBillingProvider',
  npi: '0000000000',
  taxId: '000000000',
  addressLine: 'stub address line',
  city: 'Stub city',
  state: 'CA',
  zipCode: '00000',
  zipPlusFourCode: '0000',
};

const SERVICE_FACILITY_LOCATION_STATE = 'CA';

const SERVICE_FACILITY_LOCATION: Location = {
  resourceType: 'Location',
  name: 'ServiceFacilityName',
  address: {
    line: ['ServiceFacilityAddressLine'],
    city: 'ServiceFacilityCity',
    state: SERVICE_FACILITY_LOCATION_STATE,
    postalCode: '54321',
  },
  extension: [
    {
      url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
      valueString: '20',
    },
  ],
};

const createCandidCreateEncounterInput = async (
  visitResources: FullAppointmentResourcePackage,
  oystehr: Oystehr
): Promise<CreateEncounterInput> => {
  const { encounter, patient } = visitResources;
  const encounterId = encounter.id;
  if (!patient?.id) {
    throw new Error(`Patient id is not defined for encounter ${encounterId}`);
  }
  const { coverages, insuranceOrgs } = await getAccountAndCoverageResourcesForPatient(patient.id, oystehr);
  const coverage = coverages.primary;
  const coverageSubscriber = coverages.primarySubscriber;
  const coveragePayor = findOrgMatchingReference(coverage?.payor[0]?.reference, insuranceOrgs);
  if (coverage && (!coverageSubscriber || !coveragePayor)) {
    throw MISSING_PATIENT_COVERAGE_INFO_ERROR;
  }

  if (!encounter.id) {
    throw new Error(`Encounter id is not defined for encounter ${encounterId} in createCandidCreateEncounterInput`);
  }

  const { appointment, location } = await fetchFHIRPatientAndAppointmentFromEncounter(encounter.id, oystehr);

  const practitionerId = getAttendingPractitionerId(encounter);
  let practitioner: Practitioner | null = null;
  if (practitionerId) {
    practitioner = visitResources.practitioners?.find((practitioner) => practitioner.id === practitionerId) ?? null;
  }
  if (!practitioner) {
    practitioner = visitResources.practitioners?.[0] ?? null;
  }

  const [conditions, emCodes] = await Promise.all([
    oystehr.fhir
      .search<Condition>({
        resourceType: 'Condition',
        params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
      })
      .then((r) => r.unbundle()),
    getEmCodes(oystehr),
  ]);

  const procedures = (
    await oystehr.fhir.search<Procedure>({
      resourceType: 'Procedure',
      params: [
        {
          name: 'subject',
          value: assertDefined(encounter.subject?.reference, `Patient id on encounter ${encounterId}`),
        },
        {
          name: 'encounter',
          value: `Encounter/${encounterId}`,
        },
      ],
    })
  )
    .unbundle()
    .filter(
      (procedure) =>
        chartDataResourceHasMetaTagByCode(procedure, 'cpt-code') ||
        chartDataResourceHasMetaTagByCode(procedure, 'em-code')
    );

  const maIds = procedures
    .flatMap((p) => p.partOf ?? [])
    .map((ref) => ref.reference)
    .filter((ref): ref is string => ref != null && ref.startsWith('MedicationAdministration/'))
    .map((ref) => ref.replace('MedicationAdministration/', ''));
  const uniqueMaIds = [...new Set(maIds)];
  let medicationAdministrations: MedicationAdministration[] = [];
  if (uniqueMaIds.length > 0) {
    medicationAdministrations = (
      await oystehr.fhir.search<MedicationAdministration>({
        resourceType: 'MedicationAdministration',
        params: [{ name: '_id', value: uniqueMaIds.join(',') }],
      })
    ).unbundle() as MedicationAdministration[];
  }

  return {
    appointment: appointment,
    location,
    encounter: encounter,
    patient: assertDefined(visitResources.patient, `Patient on encounter ${encounterId}`),
    practitioner: assertDefined(practitioner, `Practitioner on encounter ${encounterId}`),
    diagnoses: conditions.filter(
      (condition) =>
        encounter.diagnosis?.find((diagnosis) => diagnosis.condition?.reference === 'Condition/' + condition.id) != null
    ),
    procedures,
    medicationAdministrations,
    insuranceResources: coverage
      ? {
          coverage,
          subscriber: coverageSubscriber!,
          payor: coveragePayor!,
        }
      : undefined,
    accident: conditions.find((condition) => chartDataResourceHasMetaTagByCode(condition, 'accident')),
    emCodes,
  };
};

function getNpi(identifiers: Identifier[] | undefined): string | undefined {
  return getIdentifierValueBySystem(identifiers, FHIR_IDENTIFIER_NPI);
}

function getIdentifierValueBySystem(identifiers: Identifier[] | undefined, system: string): string | undefined {
  return identifiers?.find((identifier: Identifier) => identifier.system === system)?.value;
}

function getExtensionString(extensions: Extension[] | undefined, url: string): string | undefined {
  return extensions?.find((extension: Extension) => extension.url === url)?.valueString;
}

export function createCandidDiagnoses(encounter: Encounter, diagnoses: Condition[]): DiagnosisCreate[] {
  const isPrimary = (encounterDiagnosis: EncounterDiagnosis): boolean => (encounterDiagnosis.rank ?? -1) === 1;
  // Process the primary diagnosis first so that if the same code is also entered as a secondary
  // diagnosis, the primary wins the code-based dedup below and is not dropped (which would otherwise
  // cause the send-claim flow to fail with "Primary diagnosis is absent").
  const orderedDiagnoses = [...(encounter.diagnosis ?? [])].sort((a, b) => Number(isPrimary(b)) - Number(isPrimary(a)));
  const seenCodes = new Set<string>();
  return orderedDiagnoses.flatMap<DiagnosisCreate>((encounterDiagnosis) => {
    const diagnosisResourceId = encounterDiagnosis.condition.reference?.split('/')[1];
    const diagnosisResource = diagnoses.find((resource) => resource.id === diagnosisResourceId);
    const diagnosisCode = diagnosisResource?.code?.coding?.[0].code;
    if (diagnosisCode == null || seenCodes.has(diagnosisCode)) {
      return [];
    }
    seenCodes.add(diagnosisCode);
    return [
      {
        codeType: isPrimary(encounterDiagnosis) ? DiagnosisTypeCode.Abk : DiagnosisTypeCode.Abf,
        code: diagnosisCode,
      },
    ];
  });
}

async function fetchBillingProviderData(
  renderingProviderNpi: string,
  payerName: string,
  state: string,
  apiClient: CandidApiClient
): Promise<BillingProviderData> {
  const providersResponse = await apiClient.organizationProviders.v3.getMulti({
    npi: renderingProviderNpi,
    isRendering: true,
  });
  const renderingProviderId = providersResponse.ok
    ? providersResponse.body.items[0]?.organizationProviderId
    : undefined;
  if (renderingProviderId == null) {
    return STUB_BILLING_PROVIDER_DATA;
  }
  const contractsResponse = await apiClient.contracts.v2.getMulti({
    renderingProviderIds: [RenderingProviderid(renderingProviderId)],
    payerNames: payerName,
    contractStatus: 'effective',
    states: state as State,
  });
  const contractingProvider =
    contractsResponse.ok && contractsResponse.body.items.length === 1
      ? contractsResponse.body.items[0].contractingProvider
      : undefined;
  const billingProviderId =
    contractingProvider != null && contractingProvider.isBilling
      ? contractingProvider.organizationProviderId
      : undefined;
  if (billingProviderId == null) {
    return STUB_BILLING_PROVIDER_DATA;
  }
  const billingProviderResponse = await apiClient.organizationProviders.v3.get(billingProviderId);
  if (!billingProviderResponse.ok) {
    return STUB_BILLING_PROVIDER_DATA;
  }
  const billingProvider = billingProviderResponse.body;
  const billingProviderAddress = billingProvider.addresses?.[0]?.address;
  if (billingProviderAddress == null) {
    return STUB_BILLING_PROVIDER_DATA;
  }
  const billingProviderTaxId = billingProvider.taxId;
  if (billingProviderTaxId == null) {
    return STUB_BILLING_PROVIDER_DATA;
  }
  return {
    organizationName: billingProvider.organizationName,
    firstName: billingProvider.firstName,
    lastName: billingProvider.lastName,
    npi: billingProvider.npi,
    taxId: billingProviderTaxId,
    addressLine: billingProviderAddress.address1,
    city: billingProviderAddress.city,
    state: billingProviderAddress.state,
    zipCode: billingProviderAddress.zipCode,
    zipPlusFourCode: billingProviderAddress.zipPlusFourCode,
  };
}
/*
  Modify this function in order to add custom logic of selecting a billing provider for "self pay" appointments.
*/
function getSelfPayBillingProvider(): BillingProviderData {
  return STUB_BILLING_PROVIDER_DATA;
}

export async function fetchPreEncounterPatient(
  medicalRecordNumber: string,
  apiClient: CandidApiClient
): Promise<CandidPreEncounterPatient | undefined> {
  const patientResponse = await apiClient.preEncounter.patients.v1.getMulti({
    limit: 1,
    mrn: medicalRecordNumber,
  });
  const patient: CandidPreEncounterPatient | undefined =
    patientResponse.ok && patientResponse.body.items.length === 1 ? patientResponse.body.items[0] : undefined;
  return patient;
}

async function createOrUpdatePreEncounterPatient(
  patient: Patient,
  candidPatient: CandidPreEncounterPatient | undefined,
  nonInsurancePayerId: string | undefined,
  apiClient: CandidApiClient
): Promise<CandidPreEncounterPatient> {
  if (!patient.birthDate) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient date of birth is required. Please update the patient record and try again.'
    );
  }

  if (!patient.id) {
    throw new Error('Patient ID is required');
  }

  const medicalRecordNumber = patient.id;
  const patientName = patient.name?.[0];

  if (!patientName?.given?.[0]) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient first name is required. Please update the patient record and try again.'
    );
  }
  if (!patientName?.family) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient last name is required. Please update the patient record and try again.'
    );
  }

  console.log('[CLAIM SUBMISSION] patient details ', patient);

  const patientAddress = patient.address?.[0];
  if (!patientAddress) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient address is required. Please update the patient record and try again.'
    );
  }
  if (!patientAddress.line?.[0]) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient address first line is required. Please update the patient record and try again.'
    );
  }
  if (!patientAddress.city) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient address city is required. Please update the patient record and try again.'
    );
  }
  if (!patientAddress.state) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient address state is required. Please update the patient record and try again.'
    );
  }
  if (!patientAddress.postalCode) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient address postal code is required. Please update the patient record and try again.'
    );
  }

  const firstName = patientName?.given?.[0];
  const lastName = patientName?.family;
  const gender = patient.gender as Gender;
  if (!gender) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient gender is required. Please update the patient record and try again.'
    );
  }
  const dateOfBirth = patient.birthDate;
  const patientPhone = patient.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  if (!patientPhone) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient phone number is required. Please update the patient record and try again.'
    );
  }

  const baseCreateOrUpdatePayload: CandidApi.preEncounter.patients.v1.MutablePatient = {
    name: {
      family: lastName,
      given: [firstName],
      use: 'USUAL',
    },
    otherNames: [],
    birthDate: dateOfBirth,
    biologicalSex: mapGenderToSex(gender),
    primaryAddress: {
      line: patientAddress.line,
      city: patientAddress.city,
      state: patientAddress.state as State,
      postalCode: patientAddress.postalCode,
      use: mapAddressUse(patientAddress.use),
      country: patientAddress.country ? patientAddress.country : 'US',
    },
    otherAddresses: [],
    primaryTelecom: {
      value: patientPhone,
      use: ContactPointUse.Home,
    },
    otherTelecoms: [],
    contacts: [],
    generalPractitioners: [],
    filingOrder: {
      coverages: [],
    },
    nonInsurancePayerAssociations: nonInsurancePayerId
      ? [
          {
            id: CanonicalNonInsurancePayerId(nonInsurancePayerId),
          },
        ]
      : undefined,
  };

  // Update existing patient
  if (candidPatient) {
    const patientResponse = await apiClient.preEncounter.patients.v1.update(
      candidPatient.id,
      (candidPatient.version + 1).toString(),
      baseCreateOrUpdatePayload
    );

    if (!patientResponse.ok) {
      throw new Error(
        `Error creating Candid patient with MRN ${medicalRecordNumber}. Response body: ${JSON.stringify(
          patientResponse.error
        )}`
      );
    }

    return patientResponse.body;
  }

  const createBody: CandidApi.preEncounter.patients.v1.CreatePatientWithMrnRequest = {
    skipDuplicateCheck: true, // continue adding to candid, even if it's a duplicate
    body: {
      ...baseCreateOrUpdatePayload,
      mrn: medicalRecordNumber,
    },
  };

  const patientResponse = await apiClient.preEncounter.patients.v1.createWithMrn(createBody);

  if (!patientResponse.ok) {
    throw new Error(
      `Error creating Candid patient with MRN ${medicalRecordNumber}. Response body: ${JSON.stringify(
        patientResponse.error
      )}`
    );
  }

  return patientResponse.body;
}

function mapGenderToSex(gender?: Gender): Sex {
  switch (gender) {
    case 'male':
      return Sex.Male;
    case 'female':
      return Sex.Female;
    case 'unknown':
      return Sex.Unknown;
    case 'other':
    default:
      return Sex.Refused;
  }
}

function mapAddressUse(use?: ('home' | 'work' | 'temp' | 'old' | 'billing') | undefined): AddressUse {
  switch (use) {
    case 'home':
      return AddressUse.Home;
    case 'work':
      return AddressUse.Work;
    case 'billing':
      return AddressUse.Billing;
    case 'temp':
      return AddressUse.Temp;
    case 'old':
      return AddressUse.Old;
    default:
      return AddressUse.Home;
  }
}

export async function createAppointment(
  patient: Patient,
  appointment: Appointment,
  apiClient: CandidApiClient
): Promise<string | undefined> {
  const patientId = assertDefined(
    patient.identifier?.find((identifier) => identifier.system === CANDID_PATIENT_ID_IDENTIFIER_SYSTEM)?.value,
    'Patient RCM Identifier'
  );

  const appointmentStart = DateTime.fromISO(assertDefined(appointment.start, 'Appointment start timestamp')).toJSDate();

  const appointmentResponse = await apiClient.preEncounter.appointments.v1.create({
    patientId: PatientId(patientId),
    startTimestamp: appointmentStart,
    serviceDuration: 0,
    services: [],
  });
  const appointmentId = appointmentResponse.ok && appointmentResponse.body.id ? appointmentResponse.body.id : undefined;
  return appointmentId;
}

export interface PerformCandidPreEncounterSyncInput {
  encounterId: string;
  oystehr: Oystehr;
  candidApiClient: CandidApiClient;
  amountCents?: number; // When amountCents is not provided, no payment will be recorded
}

//
// Candid Pre-Encounter Integration
//
// 1. Look up the Candid patient from FHIR encounter ID->Patient Id
//   a. if Candid patient is not found, create a Candid patient
// 2. check if Candid patient has coverages, if not, add coverages to Candid patient
//   a. Use https://github.com/masslight/ottehr/blob/candid-pre-encounter-and-copay/packages/zambdas/src/shared/candid.ts#L394
// 3. look up Candid patient appointments for the date of the visit using get-appointments-multi (candid sdk)
//    a. if yes, grab the latest one, you need the appointment ID
//    b. if not, create a Candid appointment for the patient
// 4. record patient payment in candid (amount in cents, allocation of type "appointment", appointment ID noted above)

export const performCandidPreEncounterSync = async (input: PerformCandidPreEncounterSyncInput): Promise<void> => {
  const { encounterId, oystehr, candidApiClient, amountCents } = input;

  const {
    patient: ourPatient,
    appointment: ourAppointment,
    encounter: ourEncounter,
  } = await fetchFHIRPatientAndAppointmentFromEncounter(encounterId, oystehr);

  if (!ourPatient.id) {
    throw new Error(`Patient ID is not defined for encounter ${encounterId}`);
  }
  const { coverages, insuranceOrgs, occupationalMedicineAccount } = await getAccountAndCoverageResourcesForPatient(
    ourPatient.id,
    oystehr
  );

  let nonInsurancePayerId: string | undefined = undefined;
  if (occupationalMedicineAccount) {
    const ownerOrganizationId = occupationalMedicineAccount.owner?.reference?.split('/')[1];
    if (ownerOrganizationId) {
      const occupationalMedicineEmployerOrganization = await oystehr.fhir.get<Organization>({
        id: occupationalMedicineAccount.owner?.reference?.split('/')[1] || '',
        resourceType: 'Organization',
      });
      nonInsurancePayerId = occupationalMedicineEmployerOrganization.identifier?.find(
        (identifier) => identifier.system === CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM
      )?.value;
      if (!nonInsurancePayerId) {
        console.error(
          `Occupational Medicine Employer Organization ${ownerOrganizationId} does not have a Candid Non-Insurance Payer ID.`
        );
      }
    } else {
      console.error(
        `Occupational Medicine Account ${occupationalMedicineAccount.id} does not have an owner organization.`
      );
    }
  }

  // Get Candid Patient and create if it does not exist
  let candidPreEncounterPatient = await fetchPreEncounterPatient(ourPatient.id, candidApiClient);

  candidPreEncounterPatient = await createOrUpdatePreEncounterPatient(
    ourPatient,
    candidPreEncounterPatient,
    nonInsurancePayerId,
    candidApiClient
  );

  const candidCoverages = await createCandidCoverages(
    ourPatient,
    ourAppointment,
    candidPreEncounterPatient,
    coverages,
    insuranceOrgs,
    candidApiClient,
    shouldUseCashPayCoverage(ourEncounter, ourAppointment)
  );

  // Update patient with the coverages
  if (candidCoverages.length > 0) {
    candidPreEncounterPatient = await updateCandidPatientWithCoverages(
      candidPreEncounterPatient,
      candidCoverages,
      candidApiClient
    );
  }

  // Get Candid appointment and create if it does not exist
  const existingCandidPreEncounterAppointmentId = ourAppointment.identifier?.find(
    (identifier) => identifier.system === CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM
  )?.value;

  let candidPreEncounterAppointment: CandidPreEncounterAppointment;
  if (existingCandidPreEncounterAppointmentId) {
    candidPreEncounterAppointment = await fetchPreEncounterAppointment(
      existingCandidPreEncounterAppointmentId,
      candidApiClient
    );
  } else {
    candidPreEncounterAppointment = await createPreEncounterAppointment(
      candidPreEncounterPatient,
      ourAppointment,
      oystehr,
      candidApiClient
    );
  }

  if (amountCents) {
    await createPreEncounterPatientPayment(ourPatient, candidPreEncounterAppointment, amountCents, candidApiClient);
  }
};

const createPreEncounterPatientPayment = async (
  ourPatient: Patient,
  candidAppointment: CandidPreEncounterAppointment,
  amountCents: number,
  candidApiClient: CandidApiClient
): Promise<void> => {
  if (!ourPatient.id) {
    throw new Error(`Patient ID is not defined for patient ${JSON.stringify(ourPatient)}`);
  }

  await candidApiClient.patientPayments.v4.create({
    patientExternalId: PatientExternalId(ourPatient.id),
    amountCents,
    allocations: [
      {
        amountCents,
        target: {
          type: 'appointment_by_id_and_patient_external_id',
          appointmentId: CandidAppointmentId(candidAppointment.id),
          patientExternalId: PatientExternalId(ourPatient.id),
        },
      },
    ],
  });
};

const createPreEncounterAppointment = async (
  candidPatient: CandidPreEncounterPatient,
  appointment: Appointment,
  oystehr: Oystehr,
  candidApiClient: CandidApiClient
): Promise<CandidPreEncounterAppointment> => {
  if (!appointment.start) {
    throw new Error(`Appointment period start is not defined for appointment ${appointment.id}`);
  }

  const startTime = DateTime.fromISO(appointment.start).toJSDate();
  const response = await candidApiClient.preEncounter.appointments.v1.create({
    patientId: PatientId(candidPatient.id),
    startTimestamp: startTime,
    serviceDuration: 30,
    services: [],
  });

  if (!response.ok) {
    throw new Error(`Error creating Candid appointment. Response body: ${JSON.stringify(response.error)}`);
  }

  if (!appointment.id) {
    throw new Error(`Appointment ID is not defined for appointment ${JSON.stringify(appointment)}`);
  }

  const patchOperations: Operation[] = [];
  patchOperations.push({
    op: appointment.identifier === undefined ? 'add' : 'replace',
    path: '/identifier',
    value: [
      {
        system: CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM,
        value: response.body.id,
      },
    ],
  });

  await oystehr.fhir.patch<Appointment>({
    resourceType: 'Appointment',
    id: appointment.id,
    operations: patchOperations,
  });

  return response.body;
};

const fetchPreEncounterAppointment = async (
  candidAppointmentId: string,
  candidApiClient: CandidApiClient
): Promise<CandidPreEncounterAppointment> => {
  const response = await candidApiClient.preEncounter.appointments.v1.get(
    CandidPreEncounterAppointmentId(candidAppointmentId)
  );
  if (!response.ok) {
    throw new Error(`Error fetching Candid appointment. Response body: ${JSON.stringify(response.error)}`);
  }
  return response.body;
};

const updateCandidPatientWithCoverages = async (
  candidPatient: CandidPreEncounterPatient,
  candidCoverages: CandidPreEncounterCoverage[],
  candidApiClient: CandidApiClient
): Promise<CandidPreEncounterPatient> => {
  const updatedPatient: CandidPreEncounterPatient = {
    ...candidPatient,
    filingOrder: {
      coverages: candidCoverages.map((coverage) => coverage.id),
    },
  };

  const patientResponse = await candidApiClient.preEncounter.patients.v1.update(
    candidPatient.id,
    (candidPatient.version + 1).toString(),
    updatedPatient
  );

  if (!patientResponse.ok) {
    throw new Error(`Error updating Candid patient. Response body: ${JSON.stringify(patientResponse.error)}`);
  }

  return patientResponse.body;
};

const createCandidCoverages = async (
  patient: Patient,
  appointment: Appointment,
  candidPatient: CandidPreEncounterPatient,
  coverages: OrderedCoveragesWithSubscribers,
  insuranceOrgs: Organization[],
  candidApiClient: CandidApiClient,
  useCashPayCoverage: boolean
): Promise<CandidPreEncounterCoverage[]> => {
  if (!patient.id) {
    throw new Error(`Patient ID is not defined for patient ${JSON.stringify(patient)}`);
  }

  const candidCoverages: CandidPreEncounterCoverage[] = [];

  // For employer-paid and self-pay visits, do not send any insurance coverage. Instead send a single
  // "Cash Pay" coverage so an insurance payer that may have been selected by accident is never billed.
  // (For employer-paid occupational medicine visits, the employer is additionally sent as a
  // non-insurance payer elsewhere in the sync.)
  if (useCashPayCoverage) {
    const candidCoverage = buildCashPayCoverageCreateInput(patient, candidPatient);
    const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
    if (!response.ok) {
      throw new Error(`Error creating Candid Cash Pay coverage. Response body: ${JSON.stringify(response.error)}`);
    }
    candidCoverages.push(response.body);
    return candidCoverages;
  }

  if (coverages === undefined) {
    return candidCoverages;
  }
  const primaryInsuranceOrg = insuranceOrgs.find((org) => {
    const payerId = getPayerId(org);
    return (
      createReference(org).reference === coverages.primary?.payor?.[0].reference ||
      (payerId !== undefined && getPayerUrl(payerId) === coverages.primary?.payor?.[0].reference)
    );
  });
  const secondaryInsuranceOrg = insuranceOrgs.find((org) => {
    const payerId = getPayerId(org);
    return (
      createReference(org).reference === coverages.secondary?.payor?.[0].reference ||
      (payerId !== undefined && getPayerUrl(payerId) === coverages.secondary?.payor?.[0].reference)
    );
  });
  const workersCompInsuranceOrg = insuranceOrgs.find((org) => {
    const payerId = getPayerId(org);
    return (
      createReference(org).reference === coverages.workersComp?.payor?.[0].reference ||
      (payerId !== undefined && getPayerUrl(payerId) === coverages.workersComp?.payor?.[0].reference)
    );
  });

  if (coverages.primary && coverages.primarySubscriber && primaryInsuranceOrg) {
    const candidCoverage = buildCandidCoverageCreateInput(
      coverages.primary,
      coverages.primarySubscriber,
      primaryInsuranceOrg,
      candidPatient
    );
    const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
    if (!response.ok) {
      throw new Error(`Error creating Candid Primary coverage. Response body: ${JSON.stringify(response.error)}`);
    }
    candidCoverages.push(response.body);
  }

  if (coverages.secondary && coverages.secondarySubscriber && secondaryInsuranceOrg) {
    const candidCoverage = buildCandidCoverageCreateInput(
      coverages.secondary,
      coverages.secondarySubscriber,
      secondaryInsuranceOrg,
      candidPatient
    );
    const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
    if (!response.ok) {
      throw new Error(`Error creating Candid Secondary coverage. Response body: ${JSON.stringify(response.error)}`);
    }
    candidCoverages.push(response.body);
  }

  if (coverages.workersComp && workersCompInsuranceOrg) {
    const candidCoverage = buildCandidCoverageCreateInput(
      coverages.workersComp,
      patient,
      workersCompInsuranceOrg,
      candidPatient
    );
    const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
    if (!response.ok) {
      throw new Error(`Error creating Candid Workers Comp coverage. Response body: ${JSON.stringify(response.error)}`);
    }

    // if visit type is WC put WC insurance first in the candidCoverages array. otherwise, put it at the end?
    if (isAppointmentWorkersComp(appointment)) {
      candidCoverages.unshift(response.body);
    } else {
      candidCoverages.push(response.body);
    }
  }

  return candidCoverages;
};

const buildCashPayCoverageCreateInput = (
  patient: Patient,
  candidPatient: CandidPreEncounterPatient
): MutableCoverage => {
  if (!patient.name?.[0].family || !patient.name?.[0].given) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient name is required. Please update the patient record and try again.'
    );
  }
  if (!patient.birthDate) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient date of birth is required. Please update the patient record and try again.'
    );
  }
  if (
    !patient.address?.[0].line ||
    !patient.address?.[0].city ||
    !patient.address?.[0].state ||
    !patient.address?.[0].postalCode
  ) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, patient address is required. Please update the patient record and try again.'
    );
  }

  return {
    subscriber: {
      name: {
        family: patient.name?.[0].family,
        given: patient.name?.[0].given,
        use: (patient.name?.[0].use?.toUpperCase() as NameUse) ?? 'USUAL',
      },
      dateOfBirth: patient.birthDate,
      biologicalSex: mapGenderToSex(patient.gender),
      address: {
        line: patient.address?.[0].line,
        city: patient.address?.[0].city,
        state: patient.address?.[0].state,
        postalCode: patient.address?.[0].postalCode,
        use: mapAddressUse(patient.address?.[0].use),
        country: patient.address?.[0].country ?? 'US',
      },
    },
    relationship: Relationship.Self,
    status: 'ACTIVE',
    patient: candidPatient.id,
    verified: true,
    insurancePlan: {
      memberId: assertDefined(patient.id, 'Patient ID'),
      payerName: CANDID_CASH_PAY_PAYER,
      payerId: PayerId(CANDID_CASH_PAY_PAYER),
    },
  };
};

/**
 * Forces the Candid patient's coverage filing order to a single "Cash Pay" coverage. Used for
 * employer-paid (occupational medicine) and self-pay claims to guarantee an insurance payer is never
 * billed, even when the pre-encounter sync (which normally applies this override) was skipped because
 * a Candid pre-encounter appointment already existed (e.g. payment was collected at check-in).
 */
const enforceCashPayCoverageForCandidPatient = async (
  patient: Patient,
  candidApiClient: CandidApiClient
): Promise<void> => {
  if (!patient.id) {
    throw new Error(`Patient ID is not defined for patient ${JSON.stringify(patient)}`);
  }
  const candidPatient = await fetchPreEncounterPatient(patient.id, candidApiClient);
  if (!candidPatient) {
    throw new Error(`Candid patient not found for patient ${patient.id} while enforcing Cash Pay coverage`);
  }
  const candidCoverage = buildCashPayCoverageCreateInput(patient, candidPatient);
  const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
  if (!response.ok) {
    throw new Error(`Error creating Candid Cash Pay coverage. Response body: ${JSON.stringify(response.error)}`);
  }
  await updateCandidPatientWithCoverages(candidPatient, [response.body], candidApiClient);
};

const buildCandidCoverageCreateInput = (
  coverage: Coverage,
  subscriber: RelatedPerson | Patient, // Patient as subscriber is used in workers comp
  insuranceOrg: Organization,
  candidPatient: CandidPreEncounterPatient
): MutableCoverage => {
  if (!subscriber.name?.[0].family || !subscriber.name?.[0].given) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, insurance subscriber name is required. Please update the patient record and try again.'
    );
  }
  if (!subscriber.birthDate) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, insurance subscriber date of birth is required. Please update the patient record and try again.'
    );
  }
  if (
    !subscriber.address?.[0].line ||
    !subscriber.address?.[0].city ||
    !subscriber.address?.[0].state ||
    !subscriber.address?.[0].postalCode
  ) {
    throw INVALID_INPUT_ERROR(
      'In order to collect payment, insurance subscriber address is required. Please update the patient record and try again.'
    );
  }

  return {
    subscriber: {
      name: {
        family: subscriber.name?.[0].family,
        given: subscriber.name?.[0].given,
        use: (subscriber.name?.[0].use?.toUpperCase() as NameUse) ?? 'USUAL', // TODO default to usual if not specified
      },
      dateOfBirth: subscriber.birthDate,
      biologicalSex: mapGenderToSex(subscriber.gender),
      address: {
        line: subscriber.address?.[0].line,
        city: subscriber.address?.[0].city,
        state: subscriber.address?.[0].state,
        postalCode: subscriber.address?.[0].postalCode,
        use: mapAddressUse(subscriber.address?.[0].use),
        country: subscriber.address?.[0].country ?? 'US', // TODO just save country into the FHIR resource when making it https://build.fhir.org/datatypes-definitions.html#Address.country. We can put US by default to start.
      },
    },
    relationship: convertCoverageRelationshipToCandidRelationship(
      assertDefined(coverage.relationship?.coding?.[0].code, 'Subscriber relationship')
    ),
    status: 'ACTIVE',
    patient: candidPatient.id,
    verified: true,
    insurancePlan: {
      memberId: assertDefined(coverage.subscriberId, 'Member ID'),
      payerName: assertDefined(insuranceOrg.name, 'Payor name'),
      payerId: PayerId(assertDefined(getPayerId(insuranceOrg), 'Payor id')),
      planType: getCandidPlanTypeCodeFromCoverage(coverage),
    },
  };
};

function convertCoverageRelationshipToCandidRelationship(relationship: string): Relationship {
  const normalizedString = relationship.toUpperCase().trim();

  //
  // Normalize the string to match the expected values from FHIR specification
  // defined here https://build.fhir.org/valueset-subscriber-relationship.html
  //
  //
  switch (normalizedString) {
    case 'SELF':
      return Relationship.Self;
    case 'SPOUSE':
      return Relationship.Spouse;
    case 'PARENT':
      return Relationship.Other;
    case 'CHILD':
      return Relationship.Child;
    case 'COMMON':
      return Relationship.CommonLawSpouse;
    default:
      return Relationship.Other;
  }
}

function getLocalDateOfService(appointmentStart: string, location: Location | undefined): string {
  const timezone = location ? getTimezone(location) : TIMEZONES[0];
  return DateTime.fromISO(appointmentStart).setZone(timezone).toISODate()!;
}

const fetchFHIRPatientAndAppointmentFromEncounter = async (
  encounterId: string,
  oystehr: Oystehr
): Promise<{ patient: Patient; appointment: Appointment; location: Location | undefined; encounter: Encounter }> => {
  const searchBundleResponse = (
    await oystehr.fhir.search<Encounter | Patient | Appointment | Location>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
      ],
    })
  ).unbundle();

  const patient = searchBundleResponse.find((resource) => resource.resourceType === 'Patient') as Patient | undefined;
  if (!patient) {
    throw new Error(`Patient not found for encounter ID: ${encounterId}`);
  }

  const appointment = searchBundleResponse.find((resource) => resource.resourceType === 'Appointment') as
    | Appointment
    | undefined;
  if (!appointment) {
    throw new Error(`Appointment not found for encounter ID: ${encounterId}`);
  }

  const encounter = searchBundleResponse.find(
    (resource) => resource.resourceType === 'Encounter' && resource.id === encounterId
  ) as Encounter | undefined;
  if (!encounter) {
    throw new Error(`Encounter not found for encounter ID: ${encounterId}`);
  }

  const location = searchBundleResponse.find((resource) => resource.resourceType === 'Location') as
    | Location
    | undefined;

  return {
    patient,
    appointment,
    location,
    encounter,
  };
};

export async function createEncounterFromAppointment(
  visitResources: FullAppointmentResourcePackage,
  oystehr: Oystehr,
  candidApiClient: CandidApiClient
): Promise<string | undefined> {
  console.log('[CLAIM SUBMISSION] Starting encounter submission to candid');
  let createEncounterInput = await createCandidCreateEncounterInput(visitResources, oystehr);

  let didPreEncounterSync = false;
  if (
    !createEncounterInput.appointment.identifier?.find(
      (identifier) => identifier.system === CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM
    )?.value
  ) {
    // If this is not set, then we did not yet complete pre-encounter sync by collecting any payment before the visit, so we need to do that now.
    console.log('Candid pre-encounter appointment ID is not set, performing pre-encounter sync.');

    if (!visitResources.encounter.id) {
      throw new Error(`Encounter ID is not defined for visit resources ${JSON.stringify(visitResources)}`);
    }
    console.log(`[CLAIM SUBMISSION] Starting patient & encounter sync for encounter ${visitResources.encounter.id}`);
    await performCandidPreEncounterSync({
      encounterId: visitResources.encounter.id,
      oystehr,
      candidApiClient,
    });
    console.log(`[CLAIM SUBMISSION] Sync completed for encounter  ${visitResources.encounter.id}`);
    createEncounterInput = await createCandidCreateEncounterInput(visitResources, oystehr);
    didPreEncounterSync = true;
  }

  // The Cash Pay override is applied during pre-encounter sync. If that sync was skipped (because a
  // Candid pre-encounter appointment already existed, e.g. payment was collected at check-in), force
  // the Cash Pay filing order here so employer-paid and self-pay claims never bill an insurance payer
  // that may have been selected.
  if (!didPreEncounterSync && shouldUseCashPayCoverage(visitResources.encounter, visitResources.appointment)) {
    console.log('[CLAIM SUBMISSION] Enforcing Cash Pay coverage for employer-paid/self-pay claim');
    await enforceCashPayCoverageForCandidPatient(createEncounterInput.patient, candidApiClient);
  }

  const request = await candidCreateEncounterFromAppointmentRequest(createEncounterInput, candidApiClient);
  console.log('Candid request:' + JSON.stringify(request, null, 2));
  console.log(`[CLAIM SUBMISSION] Sending encounter to candid`);
  const response = await retryCandidCall(() => candidApiClient.encounters.v4.createFromPreEncounterPatient(request));
  console.log(`[CLAIM SUBMISSION] Encounter sent to candid, response from candid ${JSON.stringify(response)}`);

  let candidEncounterId: CandidApi.EncounterId | undefined;
  if (!response.ok) {
    if (response.rawResponse.status === 422) {
      candidEncounterId = await recoverCandidEncounterAfter422(visitResources.encounter.id!, candidApiClient);
    } else {
      throw new Error(`Error creating a Candid encounter. Response body: ${JSON.stringify(response.error)}`);
    }
  } else {
    candidEncounterId = response.body.encounterId;
    console.log('Created Candid encounter:' + JSON.stringify(response.body));
  }

  // here we're setting claim type (self-pay or insurance-pay), if nothing provided it'll be insurance-pay
  // WC visits always bill through WC insurance, so they are always InsurancePay even when the
  // encounter's paymentVariant is selfPay (a WC patient without general insurance selects
  // "I will pay without insurance" on the payment page, which sets selfPay, but the WC insurer
  // is still the responsible party for the claim).
  const packageEncounter = visitResources.encounter;
  const paymentVariantFromEncounter = getPaymentVariantFromEncounter(packageEncounter);
  const candidResponsibleParty: ResponsiblePartyType =
    !isAppointmentWorkersComp(visitResources.appointment) && paymentVariantFromEncounter === PaymentVariant.selfPay
      ? ResponsiblePartyType.SelfPay
      : ResponsiblePartyType.InsurancePay;
  if (candidResponsibleParty && candidEncounterId) {
    const updateResponse = await retryCandidCall(() =>
      candidApiClient.encounters.v4.update(candidEncounterId, {
        responsibleParty: candidResponsibleParty,
      })
    );
    if (!updateResponse.ok) {
      throw new Error(`Error updating a Candid encounter. Response body: ${JSON.stringify(updateResponse.error)}`);
    } else {
      console.log('Updated Candid encounter:' + JSON.stringify(updateResponse.body));
    }
  }

  return candidEncounterId?.toString();
}

export async function recoverCandidEncounterAfter422(
  fhirEncounterId: string,
  candidApiClient: CandidApiClient
): Promise<CandidApi.EncounterId | undefined> {
  console.log(
    `[CLAIM SUBMISSION] EncounterExternalIdUniquenessError occurred during encounter creation with ${fhirEncounterId} external id`
  );
  const existing = await candidApiClient.encounters.v4.getAll({
    externalId: EncounterExternalId(fhirEncounterId),
    limit: 1,
  });
  if (!existing.ok || existing.body.items.length === 0) {
    throw new Error(
      `EncounterExternalIdUniquenessError: encounter with externalId ${fhirEncounterId} exists but lookup failed: ${JSON.stringify(
        existing
      )}`
    );
  }
  const candidEncounterId = existing.body.items.find((item) => item.externalId === fhirEncounterId)?.encounterId;
  console.log(`[CLAIM SUBMISSION] Recovered existing Candid encounter: ${candidEncounterId}`);
  return candidEncounterId;
}

export async function retryCandidCall<T, E>(
  fn: () => Promise<APIResponse<T, E>>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<APIResponse<T, E>> {
  let response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      response = await fn();
      // Rate-limit may come back as a non-ok response with no HTTP status; detect by error name.
      const isResponseRateLimited = !response.ok && (response.error as any)?.errorName === 'TooManyRequestsError';
      if (response.ok || (!isResponseRateLimited && !response.ok) || attempt === maxRetries) return response;
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      // "Too many requests" arrives as a thrown exception with no statusCode.
      const isRetryable =
        error?.body?.errorName === 'TooManyRequestsError' ||
        error?.message?.toLowerCase().includes('too many requests');
      if (!isRetryable) throw error;
    }
    const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
    console.warn(
      `Candid request ok: ${response?.ok}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('Candid call failed after all retries');
}

async function candidCreateEncounterFromAppointmentRequest(
  input: CreateEncounterInput,
  apiClient: CandidApiClient
): Promise<EncounterCreateFromPreEncounter> {
  const {
    appointment,
    encounter,
    patient,
    practitioner,
    diagnoses,
    procedures,
    medicationAdministrations,
    insuranceResources,
    location,
    accident,
    emCodes,
  } = input;
  const practitionerNpi = assertDefined(getNpi(practitioner.identifier), 'Practitioner NPI');
  const practitionerName = assertDefined(practitioner.name?.[0], 'Practitioner name');
  const billingProviderData = insuranceResources
    ? await fetchBillingProviderData(
        practitionerNpi,
        assertDefined(insuranceResources.payor.name, 'Payor name'),
        SERVICE_FACILITY_LOCATION_STATE,
        apiClient
      )
    : getSelfPayBillingProvider();
  const serviceFacilityAddress = assertDefined(SERVICE_FACILITY_LOCATION.address, 'Service facility address');
  const serviceFacilityPostalCodeTokens = assertDefined(
    serviceFacilityAddress.postalCode,
    'Service facility postal code'
  ).split('-');
  const candidDiagnoses = createCandidDiagnoses(encounter, diagnoses);
  const primaryDiagnosisIndex = candidDiagnoses.findIndex(
    (candidDiagnosis) => candidDiagnosis.codeType === DiagnosisTypeCode.Abk
  );
  if (primaryDiagnosisIndex === -1) {
    throw new Error('Primary diagnosis is absent');
  }

  const candidPatientId = await apiClient.preEncounter.patients.v1.getMulti({
    mrn: patient.id,
  });
  if (!candidPatientId.ok || candidPatientId.body.items.length === 0) {
    throw new Error(`Candid patient not found for patient ${patient.id}`);
  }
  if (candidPatientId.body.items.length > 1) {
    throw new Error(`Multiple Candid patients found for patient ${patient.id}`);
  }
  const candidPatient = candidPatientId.body.items[0];

  const candidAppointmentId = appointment.identifier?.find(
    (identifier) => identifier.system === CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM
  )?.value;
  if (!candidAppointmentId) {
    throw new Error(`Candid appointment ID is not defined for appointment ${appointment.id}`);
  }

  // Use appointment start time for date of service instead of signed date
  const appointmentStart = appointment.start;
  let dateOfServiceString: string | undefined;

  if (appointmentStart) {
    dateOfServiceString = getLocalDateOfService(appointmentStart, location);
  }

  const serviceLines: ServiceLineCreate[] = [];
  procedures.forEach((procedure) => {
    const procedureCoding = procedure.code?.coding?.[0];
    const procedureCode = procedureCoding?.code;

    if (procedureCode == null) {
      return;
    }

    let modifiers: ProcedureModifier[] = [];

    procedureCoding?.extension?.forEach((ext) => {
      if (ext.url === EXTENSION_URL_CPT_MODIFIER) {
        ext.valueCodeableConcept?.coding?.forEach((coding) => {
          if (coding.system === CODE_SYSTEM_CPT_MODIFIER) {
            const modifier = coding.code;
            if (modifier && isProcedureModifier(modifier)) modifiers.push(modifier);
          }
        });
      }
    });

    const isEAndMCode = emCodes.some((emCode) => emCode.code === procedureCode);
    if (isEAndMCode && isTelemedAppointment(appointment)) {
      modifiers = ['95'];
    }

    const drugIdentification = buildDrugIdentification(procedure, medicationAdministrations);
    const billableUnits = getBillableUnitsForProcedure(procedure, medicationAdministrations);

    serviceLines.push({
      procedureCode: procedureCode,
      modifiers,
      quantity: Decimal(String(billableUnits ?? 1)),
      units: ServiceLineUnits.Un,
      diagnosisPointers: [primaryDiagnosisIndex],
      dateOfService:
        dateOfServiceString ?? getLocalDateOfService(assertDefined(appointment.start, 'Appointment start'), location),
      drugIdentification,
    });
  });

  const tags: CandidApi.TagId[] = [];
  if (isAppointmentWorkersComp(appointment)) {
    tags.push(TagId(CANDID_TAG_WORKERS_COMP));
  } else if (isAppointmentOccupationalMedicine(appointment)) {
    tags.push(TagId(CANDID_TAG_OCCUPATIONAL_MEDICINE));
  } else if (isAppointmentAutoAccident(appointment)) {
    tags.push(TagId(CANDID_TAG_AUTO_ACCIDENT));
  } else if (isAppointmentPreOp(appointment)) {
    tags.push(TagId(CANDID_TAG_PRE_OP));
  }

  // Note: dateOfService field must not be provided as service line date of service is already sent
  return {
    externalId: EncounterExternalId(assertDefined(encounter.id, 'Encounter.id')),
    preEncounterPatientId: PreEncounterPatientId(candidPatient.id),
    preEncounterAppointmentIds: [PreEncounterAppointmentId(candidAppointmentId)],
    benefitsAssignedToProvider: true,
    billableStatus: BillableStatusType.Billable,
    patientAuthorizedRelease: true,
    providerAcceptsAssignment: true,
    billingProvider: {
      organizationName: billingProviderData.organizationName,
      firstName: billingProviderData.firstName,
      lastName: billingProviderData.lastName,
      npi: billingProviderData.npi,
      taxId: billingProviderData.taxId,
      address: {
        address1: billingProviderData.addressLine,
        city: billingProviderData.city,
        state: billingProviderData.state as State,
        zipCode: billingProviderData.zipCode,
        zipPlusFourCode: billingProviderData.zipPlusFourCode,
      },
    },
    renderingProvider: {
      firstName: assertDefined(practitionerName.given?.[0], 'Practitioner first name'),
      lastName: assertDefined(practitionerName.family, 'Practitioner last name'),
      npi: assertDefined(getNpi(practitioner.identifier), 'Practitioner NPI'),
    },
    serviceFacility: {
      organizationName: location?.name ?? assertDefined(SERVICE_FACILITY_LOCATION.name, 'Service facility name'),
      address: {
        address1: assertDefined(serviceFacilityAddress.line?.[0], 'Service facility address line'),
        city: assertDefined(serviceFacilityAddress.city, 'Service facility city'),
        state: assertDefined(serviceFacilityAddress.state as State, 'Service facility state'),
        zipCode: serviceFacilityPostalCodeTokens[0],
        zipPlusFourCode: serviceFacilityPostalCodeTokens[1] ?? '9998',
      },
    },
    placeOfServiceCode: assertDefined(
      getExtensionString(SERVICE_FACILITY_LOCATION.extension, CODE_SYSTEM_CMS_PLACE_OF_SERVICE) as FacilityTypeCode,
      'Location place of service code'
    ),
    diagnoses: candidDiagnoses,
    accidentDate: accident?.onsetDateTime,
    relatedCausesInformation: buildRelatedCausesInformation(accident),
    serviceLines,
    tagIds: tags,
  };
}

/**
 * Builds the Candid related-causes information from an accident-tagged Condition, or returns
 * undefined when there is nothing to send.
 *
 * A Condition may carry the "accident" meta tag but have no coding — for example when the accident
 * checkbox was toggled on and then off without the Condition being removed. In that case there are no
 * accident type codes, so we must return undefined rather than build an object with an undefined
 * relatedCausesCode1, which Candid rejects because that field is required.
 */
export function buildRelatedCausesInformation(accident: Condition | undefined): RelatedCausesInformation | undefined {
  const accidentTypes =
    accident?.code?.coding
      ?.filter((coding) => coding.system === ACCIDENT_TYPE_SYSTEM && coding.code != null)
      ?.map((coding) => coding.code as string) ?? [];

  if (accidentTypes.length === 0) {
    return undefined;
  }

  return {
    relatedCausesCode1: accidentTypes[0] as RelatedCausesCode,
    relatedCausesCode2: accidentTypes[1] as RelatedCausesCode,
    stateOrProvinceCode: accident?.extension?.find((extension) => extension.url === ACCIDENT_STATE_EXTENSION)
      ?.valueString,
  };
}

export const CANDID_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/candid';
export const makeBusinessIdentifierForCandidPayment = (candidPaymentId: string): Identifier => {
  return {
    system: CANDID_PAYMENT_ID_SYSTEM,
    value: candidPaymentId,
  };
};

export function getCandidEncounterIdFromEncounter(encounter: Encounter): string | undefined {
  return encounter.identifier?.find((idn) => idn.system === CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM)?.value;
}

const procedureModifierValues = new Set(Object.values(ProcedureModifier));

const isProcedureModifier = (code: unknown): code is ProcedureModifier => {
  return typeof code === 'string' && procedureModifierValues.has(code as ProcedureModifier);
};

export function buildDrugIdentification(
  procedure: Procedure,
  medicationAdministrations: MedicationAdministration[]
): DrugIdentification | undefined {
  const maRef = procedure.partOf?.find((ref) => ref.reference?.startsWith('MedicationAdministration/'));
  if (!maRef?.reference) return undefined;

  const maId = maRef.reference.replace('MedicationAdministration/', '');
  const ma = medicationAdministrations.find((m) => m.id === maId);
  if (!ma) return undefined;

  const medication = getMedicationFromMA(ma);
  const ndc = medication ? getNdcCodeFromMedication(medication) : undefined;
  if (!ndc) return undefined;

  const dosage = getDosageFromMA(ma);
  const doseValue = dosage?.dose ?? ma.dosage?.dose?.value;
  return {
    serviceIdQualifier: ServiceIdQualifier.Ndc542Format,
    nationalDrugCode: ndc,
    nationalDrugUnitCount: doseValue != null ? String(doseValue) : '1',
    measurementUnitCode: dosage ? mapMedicationUnitToCandid(dosage.units) : MeasurementUnitCode.Units,
  };
}

/** Returns the billable units stored for the procedure's CPT code on the linked MedicationAdministration, if any. */
export function getBillableUnitsForProcedure(
  procedure: Procedure,
  medicationAdministrations: MedicationAdministration[]
): number | undefined {
  const maRef = procedure.partOf?.find((ref) => ref.reference?.startsWith('MedicationAdministration/'));
  if (!maRef?.reference) return undefined;

  const maId = maRef.reference.replace('MedicationAdministration/', '');
  const ma = medicationAdministrations.find((m) => m.id === maId);
  if (!ma) return undefined;

  const procedureCode = procedure.code?.coding?.[0]?.code;
  if (!procedureCode) return undefined;

  const billableUnits = getCptCodesFromMA(ma)?.find((entry) => entry.code === procedureCode)?.billableUnits;
  return billableUnits != null && Number.isFinite(billableUnits) && billableUnits > 0 ? billableUnits : undefined;
}

export function mapMedicationUnitToCandid(unit: MedicationUnitOptions): MeasurementUnitCode {
  switch (unit) {
    case 'mg':
      return MeasurementUnitCode.Milligram;
    case 'ml':
      return MeasurementUnitCode.Milliliters;
    case 'g':
      return MeasurementUnitCode.Grams;
    case 'cc':
      return MeasurementUnitCode.Milliliters;
    case 'unit':
      return MeasurementUnitCode.Units;
    case 'application':
      return MeasurementUnitCode.Units;
    default:
      console.warn(`[CANDID] Unexpected medication unit "${String(unit)}"; defaulting to Units`);
      return MeasurementUnitCode.Units;
  }
}

export const makeCptModifierExtension = (input: { code: string; display: string }[]): Extension => {
  return {
    url: EXTENSION_URL_CPT_MODIFIER,
    valueCodeableConcept: {
      coding: input.map((cptCodeInfo) => ({
        system: CODE_SYSTEM_CPT_MODIFIER,
        code: cptCodeInfo.code,
        display: cptCodeInfo.display,
      })),
    },
  };
};

export const getCptModifierCodeFromProcedure = (
  fhirProcedure: Procedure
): { code: string; display: string }[] | undefined => {
  const coding = fhirProcedure.code?.coding?.find((c) => c.system === CODE_SYSTEM_CPT);
  if (!coding) return;

  const modifierCodableConcept = coding?.extension?.find(
    (ext) => ext.url === EXTENSION_URL_CPT_MODIFIER && ext.valueCodeableConcept
  )?.valueCodeableConcept;
  const modifier = modifierCodableConcept?.coding?.flatMap((c) =>
    c.system === CODE_SYSTEM_CPT_MODIFIER && c.code ? [{ code: c.code, display: c.display ?? '' }] : []
  );

  return modifier;
};

export function shouldUseCandid(secrets: Secrets): boolean {
  return (
    ['candid', 'all'].includes(secrets.BILLING_INTEGRATION) ||
    // TODO: remove this once secrets migrated
    !secrets.BILLING_INTEGRATION
  );
}

export function shouldUseOttehrBilling(secrets: Secrets): boolean {
  return ['ottehr', 'all'].includes(secrets.BILLING_INTEGRATION);
}

export function shouldSendClaim(secrets: Secrets, encounter: Encounter): boolean {
  if (shouldUseCandid(secrets)) {
    // Check if candid encounter ID already exists in encounter identifier
    const existingCandidEncounterId = encounter.identifier?.find(
      (identifier) => identifier.system === CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM
    )?.value;
    if (existingCandidEncounterId) {
      console.log(
        `[CLAIM SUBMISSION] Candid encounter already exists with ID ${existingCandidEncounterId}, skipping creation`
      );
      return false;
    }
    return true;
  }
  if (shouldUseOttehrBilling(secrets)) {
    // Always send to Ottehr billing
    return true;
  }
  return false;
}
