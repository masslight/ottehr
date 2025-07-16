import Oystehr from '@oystehr/sdk';
// cSpell:ignore Providerid
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import {
  AppointmentId as CandidAppointmentId,
  Decimal,
  DiagnosisCreate,
  DiagnosisTypeCode,
  EncounterExternalId,
  FacilityTypeCode,
  Gender,
  PatientExternalId,
  PatientRelationshipToInsuredCodeAll,
  PreEncounterAppointmentId,
  PreEncounterPatientId,
  ServiceLineUnits,
  State,
  SubscriberCreate,
} from 'candidhealth/api';
import { RenderingProviderid } from 'candidhealth/api/resources/contracts/resources/v2';
import {
  BillableStatusType,
  EncounterCreate,
  EncounterCreateFromPreEncounter,
  ResponsiblePartyType,
} from 'candidhealth/api/resources/encounters/resources/v4';
import {
  AddressUse,
  AppointmentId as CandidPreEncounterAppointmentId,
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
import { ServiceLineCreate } from 'candidhealth/api/resources/serviceLines/resources/v2';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  CodeableConcept,
  Condition,
  Coverage,
  Encounter,
  Extension,
  Identifier,
  Location,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FHIR_IDENTIFIER_NPI,
  getOptionalSecret,
  getSecret,
  INVALID_INPUT_ERROR,
  MISSING_PATIENT_COVERAGE_INFO_ERROR,
  Secrets,
  SecretsKeys,
} from 'utils';
import { CODE_SYSTEM_CMS_PLACE_OF_SERVICE } from 'utils/lib/helpers/rcm';
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

const CODE_SYSTEM_HL7_IDENTIFIER_TYPE = 'http://terminology.hl7.org/CodeSystem/v2-0203';
const CODE_SYSTEM_HL7_SUBSCRIBER_RELATIONSHIP = 'http://terminology.hl7.org/CodeSystem/subscriber-relationship';

let candidApiClient: CandidApiClient;

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
  encounter: Encounter;
  patient: Patient;
  practitioner: Practitioner;
  diagnoses: Condition[];
  procedures: Procedure[];
  insuranceResources?: InsuranceResources;
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

type CandidVisitResources = Omit<FullAppointmentResourcePackage, 'account' | 'insurancePlan' | 'coverage'>;

export async function createCandidEncounter(
  visitResources: CandidVisitResources,
  secrets: Secrets | null,
  oystehr: Oystehr
): Promise<string | undefined> {
  console.log('Create candid encounter.');
  const candidClientId = getOptionalSecret(SecretsKeys.CANDID_CLIENT_ID, secrets);
  if (candidClientId == null || candidClientId.length === 0) {
    return undefined;
  }
  const apiClient = createCandidApiClient(secrets);
  const createEncounterInput = await createCandidCreateEncounterInput(visitResources, oystehr);
  const request = await candidCreateEncounterRequest(createEncounterInput, apiClient);
  console.log('Candid request:' + JSON.stringify(request, null, 2));
  const response = await apiClient.encounters.v4.create(request);
  if (!response.ok) {
    throw new Error(`Error creating a Candid encounter. Response body: ${JSON.stringify(response.error)}`);
  }
  const encounter = response.body;
  console.log('Created Candid encounter:' + JSON.stringify(encounter));
  return encounter.encounterId;
}

function createCandidApiClient(secrets: Secrets | null): CandidApiClient {
  if (candidApiClient == null) {
    candidApiClient = new CandidApiClient({
      clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
      clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
      environment:
        getSecret(SecretsKeys.CANDID_ENV, secrets) === 'PROD'
          ? CandidApiEnvironment.Production
          : CandidApiEnvironment.Staging,
    });
  }
  return candidApiClient;
}

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
  const coveragePayor = insuranceOrgs.find(
    (insuranceOrg) => `Organization/${insuranceOrg.id}` === coverage?.payor[0]?.reference
  );
  if (coverage && (!coverageSubscriber || !coveragePayor)) {
    throw MISSING_PATIENT_COVERAGE_INFO_ERROR;
  }

  if (!encounter.id) {
    throw new Error(`Encounter id is not defined for encounter ${encounterId} in createCandidCreateEncounterInput`);
  }

  const { appointment } = await fetchFHIRPatientAndAppointmentFromEncounter(encounter.id, oystehr);

  return {
    appointment: appointment,
    encounter: encounter,
    patient: assertDefined(visitResources.patient, `Patient on encounter ${encounterId}`),
    practitioner: assertDefined(visitResources.practitioner, `Practitioner on encounter ${encounterId}`),
    diagnoses: (
      await oystehr.fhir.search<Condition>({
        resourceType: 'Condition',
        params: [
          {
            name: 'encounter',
            value: `Encounter/${encounterId}`,
          },
        ],
      })
    )
      .unbundle()
      .filter(
        (condition) =>
          encounter.diagnosis?.find((diagnosis) => diagnosis.condition?.reference === 'Condition/' + condition.id) !=
          null
      ),
    procedures: (
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
      ),
    insuranceResources: coverage
      ? {
          coverage,
          subscriber: coverageSubscriber!,
          payor: coveragePayor!,
        }
      : undefined,
  };
};

async function candidCreateEncounterRequest(
  input: CreateEncounterInput,
  apiClient: CandidApiClient
): Promise<EncounterCreate> {
  const { encounter, patient, practitioner, diagnoses, procedures, insuranceResources } = input;
  const patientName = assertDefined(patient.name?.[0], 'Patient name');
  const patientAddress = assertDefined(patient.address?.[0], 'Patient address');
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
  return {
    externalId: EncounterExternalId(assertDefined(encounter.id, 'Encounter.id')),
    billableStatus: BillableStatusType.Billable,
    responsibleParty: insuranceResources != null ? ResponsiblePartyType.InsurancePay : ResponsiblePartyType.SelfPay,
    benefitsAssignedToProvider: true,
    patientAuthorizedRelease: true,
    providerAcceptsAssignment: true,
    patient: {
      externalId: assertDefined(patient.id, 'Patient resource id'),
      firstName: assertDefined(patientName.given?.[0], 'Patient first name'),
      lastName: assertDefined(patientName.family, 'Patient last name'),
      gender: assertDefined(patient.gender as Gender, 'Patient gender'),
      dateOfBirth: assertDefined(patient.birthDate, 'Patient birth date'),
      address: {
        address1: assertDefined(patientAddress.line?.[0], 'Patient address line'),
        city: assertDefined(patientAddress.city, 'Patient city'),
        state: assertDefined(patientAddress.state as State, 'Patient state'),
        zipCode: assertDefined(patientAddress.postalCode, 'Patient postal code'),
      },
    },
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
      organizationName: assertDefined(SERVICE_FACILITY_LOCATION.name, 'Service facility name'),
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
    serviceLines: procedures.flatMap<ServiceLineCreate>((procedure) => {
      const procedureCode = procedure.code?.coding?.[0].code;
      if (procedureCode == null) {
        return [];
      }
      return [
        {
          procedureCode: procedureCode,
          quantity: Decimal('1'),
          units: ServiceLineUnits.Un,
          diagnosisPointers: [primaryDiagnosisIndex],
          dateOfService: assertDefined(
            DateTime.fromISO(assertDefined(procedure.meta?.lastUpdated, 'Procedure date')).toISODate(),
            'Service line date'
          ),
        },
      ];
    }),
    subscriberPrimary: createSubscriberPrimary(insuranceResources),
  };
}

function getNpi(identifiers: Identifier[] | undefined): string | undefined {
  return getIdentifierValueBySystem(identifiers, FHIR_IDENTIFIER_NPI);
}

function getIdentifierValue(
  identifiers: Identifier[] | undefined,
  typeSystem: string,
  typeValue: string
): string | undefined {
  return identifiers?.find((identifier) => getCode(identifier.type, typeSystem) === typeValue)?.value;
}

function getIdentifierValueBySystem(identifiers: Identifier[] | undefined, system: string): string | undefined {
  return identifiers?.find((identifier: Identifier) => identifier.system === system)?.value;
}

function getCode(codeableConcept: CodeableConcept | undefined, system: string): string | undefined {
  return codeableConcept?.coding?.find((coding) => coding.system === system)?.code;
}

function getExtensionString(extensions: Extension[] | undefined, url: string): string | undefined {
  return extensions?.find((extension: Extension) => extension.url === url)?.valueString;
}

function relationshipCode(coverage: Coverage): PatientRelationshipToInsuredCodeAll {
  const code = getCode(coverage.relationship, CODE_SYSTEM_HL7_SUBSCRIBER_RELATIONSHIP);
  if (code === 'self') {
    return PatientRelationshipToInsuredCodeAll.Self;
  }
  if (code === 'child') {
    return PatientRelationshipToInsuredCodeAll.Child;
  }
  if (code === 'spouse') {
    return PatientRelationshipToInsuredCodeAll.Spouse;
  }
  return PatientRelationshipToInsuredCodeAll.OtherRelationship;
}

function createCandidDiagnoses(encounter: Encounter, diagnoses: Condition[]): DiagnosisCreate[] {
  return (encounter.diagnosis ?? []).flatMap<DiagnosisCreate>((encounterDiagnosis) => {
    const diagnosisResourceId = encounterDiagnosis.condition.reference?.split('/')[1];
    const diagnosisResource = diagnoses.find((resource) => resource.id === diagnosisResourceId);
    const diagnosisCode = diagnosisResource?.code?.coding?.[0].code;
    if (diagnosisCode == null) {
      return [];
    }
    return [
      {
        codeType: (encounterDiagnosis.rank ?? -1) === 1 ? DiagnosisTypeCode.Abk : DiagnosisTypeCode.Abf,
        code: diagnosisCode,
      },
    ];
  });
}

function createSubscriberPrimary(insuranceResources: InsuranceResources | undefined): SubscriberCreate | undefined {
  if (insuranceResources == null) {
    return undefined;
  }
  const { coverage, subscriber, payor } = insuranceResources;
  const subscriberName = assertDefined(subscriber.name?.[0], 'Subscriber official name');
  const subscriberAddress = assertDefined(subscriber.address?.[0], 'Subscriber address');
  return {
    firstName: assertDefined(subscriberName.given?.[0], 'Subscriber first name'),
    lastName: assertDefined(subscriberName.family, 'Subscriber last name'),
    gender: assertDefined(subscriber.gender as Gender, 'Subscriber gender'),
    patientRelationshipToSubscriberCode: relationshipCode(coverage),
    dateOfBirth: assertDefined(subscriber.birthDate, 'Subscriber birth date'),
    address: {
      address1: assertDefined(subscriberAddress.line?.[0], 'Subscriber address line'),
      city: assertDefined(subscriberAddress.city, 'Subscriber city'),
      state: assertDefined(subscriberAddress.state as State, 'Subscriber state'),
      zipCode: assertDefined(subscriberAddress.postalCode, 'Subscriber postal code'),
    },
    insuranceCard: {
      memberId: assertDefined(coverage.subscriberId, 'Subscriber member id'),
      payerName: assertDefined(payor.name, 'Payor name'),
      payerId: assertDefined(getIdentifierValue(payor.identifier, CODE_SYSTEM_HL7_IDENTIFIER_TYPE, 'XX'), 'Payor id'),
    },
  };
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

async function fetchPreEncounterPatient(
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

async function createPreEncounterPatient(
  patient: Patient,
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

  console.log('alex patient,', patient);

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

  const patientResponse = await apiClient.preEncounter.patients.v1.createWithMrn({
    body: {
      mrn: medicalRecordNumber,
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
    },
  });

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
  secrets: Secrets;
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
  const { encounterId, oystehr, secrets, amountCents } = input;
  const candidApiClient = createCandidApiClient(secrets);

  const { patient: ourPatient, appointment: ourAppointment } = await fetchFHIRPatientAndAppointmentFromEncounter(
    encounterId,
    oystehr
  );

  if (!ourPatient.id) {
    throw new Error(`Patient ID is not defined for encounter ${encounterId}`);
  }

  // Get Candid Patient and create if it does not exist
  let candidPreEncounterPatient = await fetchPreEncounterPatient(ourPatient.id, candidApiClient);

  if (!candidPreEncounterPatient) {
    candidPreEncounterPatient = await createPreEncounterPatient(ourPatient, candidApiClient);
  }

  const candidCoverages = await createCandidCoverages(ourPatient, candidPreEncounterPatient, oystehr, candidApiClient);

  // Update patient with the coverages
  candidPreEncounterPatient = await updateCandidPatientWithCoverages(
    candidPreEncounterPatient,
    candidCoverages,
    candidApiClient
  );

  // Get Candid appointment and create if it does not exist
  const existingCandidPreEncounterAppointmentId = ourAppointment.identifier?.find(
    (identifier) => identifier.system === CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM
  )?.value;

  let candidPreEncounterAppointment: CandidPreEncounterAppointment;
  if (existingCandidPreEncounterAppointmentId) {
    candidPreEncounterAppointment = await fetchPreEncounterAppointment(existingCandidPreEncounterAppointmentId);
  } else {
    candidPreEncounterAppointment = await createPreEncounterAppointment(
      candidPreEncounterPatient,
      ourAppointment,
      oystehr
    );
  }

  if (amountCents) {
    await createPreEncounterPatientPayment(ourPatient, candidPreEncounterAppointment, amountCents);
  }
};

const createPreEncounterPatientPayment = async (
  ourPatient: Patient,
  candidAppointment: CandidPreEncounterAppointment,
  amountCents: number
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
  oystehr: Oystehr
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

const fetchPreEncounterAppointment = async (candidAppointmentId: string): Promise<CandidPreEncounterAppointment> => {
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
  candidPatient: CandidPreEncounterPatient,
  oystehr: Oystehr,
  candidApiClient: CandidApiClient
): Promise<CandidPreEncounterCoverage[]> => {
  if (!patient.id) {
    throw new Error(`Patient ID is not defined for patient ${JSON.stringify(patient)}`);
  }

  const { coverages, insuranceOrgs } = await getAccountAndCoverageResourcesForPatient(patient.id, oystehr);

  const candidCoverages: CandidPreEncounterCoverage[] = [];

  if (coverages.primary && coverages.primarySubscriber && insuranceOrgs[0]) {
    const candidCoverage = buildCandidCoverageCreateInput(
      coverages.primary,
      coverages.primarySubscriber,
      insuranceOrgs[0],
      candidPatient
    );
    const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
    if (!response.ok) {
      throw new Error(`Error creating Candid Primary coverage. Response body: ${JSON.stringify(response.error)}`);
    }
    candidCoverages.push(response.body);
  }

  if (coverages.secondary && coverages.secondarySubscriber && insuranceOrgs[1]) {
    const candidCoverage = buildCandidCoverageCreateInput(
      coverages.secondary,
      coverages.secondarySubscriber,
      insuranceOrgs[1],
      candidPatient
    );
    const response = await candidApiClient.preEncounter.coverages.v1.create(candidCoverage);
    if (!response.ok) {
      throw new Error(`Error creating Candid Secondary coverage. Response body: ${JSON.stringify(response.error)}`);
    }
    candidCoverages.push(response.body);
  }

  return candidCoverages;
};

const buildCandidCoverageCreateInput = (
  coverage: Coverage,
  subscriber: RelatedPerson,
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
    relationship: assertDefined(
      coverage.relationship?.coding?.[0].code,
      'Subscriber relationship'
    ).toUpperCase() as Relationship,
    status: 'ACTIVE',
    patient: candidPatient.id,
    verified: true,
    insurancePlan: {
      memberId: assertDefined(coverage.subscriberId, 'Member ID'),
      payerName: assertDefined(insuranceOrg.name, 'Payor name'),
      payerId: PayerId(assertDefined(insuranceOrg.id, 'Payor id')),
    },
  };
};

const fetchFHIRPatientAndAppointmentFromEncounter = async (
  encounterId: string,
  oystehr: Oystehr
): Promise<{ patient: Patient; appointment: Appointment }> => {
  const searchBundleResponse = (
    await oystehr.fhir.search<Encounter | Patient | Appointment>({
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

  return {
    patient,
    appointment,
  };
};

export async function createEncounterFromAppointment(
  visitResources: FullAppointmentResourcePackage,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<string | undefined> {
  console.log('Create candid encounter from appointment');
  const candidClientId = getOptionalSecret(SecretsKeys.CANDID_CLIENT_ID, secrets);
  if (candidClientId == null || candidClientId.length === 0) {
    return undefined;
  }
  const apiClient = createCandidApiClient(secrets);
  const createEncounterInput = await createCandidCreateEncounterInput(visitResources, oystehr);

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
    await performCandidPreEncounterSync({
      encounterId: visitResources.encounter.id,
      oystehr,
      secrets,
    });
  }

  const request = await candidCreateEncounterFromAppointmentRequest(createEncounterInput, apiClient);
  console.log('Candid request:' + JSON.stringify(request, null, 2));
  const response = await apiClient.encounters.v4.createFromPreEncounterPatient(request);
  if (!response.ok) {
    throw new Error(`Error creating a Candid encounter. Response body: ${JSON.stringify(response.error)}`);
  }
  const encounter = response.body;
  console.log('Created Candid encounter:' + JSON.stringify(encounter));
  return encounter.encounterId;
}

async function candidCreateEncounterFromAppointmentRequest(
  input: CreateEncounterInput,
  apiClient: CandidApiClient
): Promise<EncounterCreateFromPreEncounter> {
  const { appointment, encounter, patient, practitioner, diagnoses, procedures, insuranceResources } = input;
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
      organizationName: assertDefined(SERVICE_FACILITY_LOCATION.name, 'Service facility name'),
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
    serviceLines: procedures.flatMap<ServiceLineCreate>((procedure) => {
      const procedureCode = procedure.code?.coding?.[0].code;
      if (procedureCode == null) {
        return [];
      }
      return [
        {
          procedureCode: procedureCode,
          quantity: Decimal('1'),
          units: ServiceLineUnits.Un,
          diagnosisPointers: [primaryDiagnosisIndex],
          dateOfService: assertDefined(
            DateTime.fromISO(assertDefined(procedure.meta?.lastUpdated, 'Procedure date')).toISODate(),
            'Service line date'
          ),
        },
      ];
    }),
  };
}

export const CANDID_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/candid';
export const makeBusinessIdentifierForCandidPayment = (candidPaymentId: string): Identifier => {
  return {
    system: CANDID_PAYMENT_ID_SYSTEM,
    value: candidPaymentId,
  };
};
