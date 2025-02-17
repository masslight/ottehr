import Oystehr from '@oystehr/sdk';
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import {
  Decimal,
  DiagnosisCreate,
  DiagnosisTypeCode,
  EncounterExternalId,
  FacilityTypeCode,
  Gender,
  PatientRelationshipToInsuredCodeAll,
  ServiceLineUnits,
  State,
  SubscriberCreate,
} from 'candidhealth/api';
import { RenderingProviderid } from 'candidhealth/api/resources/contracts/resources/v2';
import {
  BillableStatusType,
  EncounterCreate,
  ResponsiblePartyType,
} from 'candidhealth/api/resources/encounters/resources/v4';
import { ServiceLineCreate } from 'candidhealth/api/resources/serviceLines/resources/v2';
import {
  CodeableConcept,
  Condition,
  Coverage,
  Encounter,
  Extension,
  FhirResource,
  Identifier,
  Location,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FHIR_IDENTIFIER_NPI } from 'utils';
import { CODE_SYSTEM_CMS_PLACE_OF_SERVICE } from 'utils/lib/helpers/rcm';
import { getOptionalSecret, getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { chartDataResourceHasMetaTagByCode } from './chart-data/chart-data-helpers';
import { assertDefined } from './helpers';
import { VideoResourcesAppointmentPackage } from './pdf/visit-details-pdf/types';

export const CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM =
  'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id';

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
  subsriber: Patient | RelatedPerson;
  payor: Organization;
}

interface CreateEncounterInput {
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

export async function createCandidEncounter(
  visitResources: VideoResourcesAppointmentPackage,
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
  visitResources: VideoResourcesAppointmentPackage,
  oystehr: Oystehr
): Promise<CreateEncounterInput> => {
  const { encounter } = visitResources;
  const encounterId = encounter.id;
  const coverage = visitResources.coverage;
  return {
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
          coverage: coverage,
          subsriber: await resourceByReference(coverage.subscriber, 'Coverage.subscriber', oystehr),
          payor: await resourceByReference(coverage.payor[0], 'Coverage.payor[0]', oystehr),
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
  const { coverage, subsriber, payor } = insuranceResources;
  const subsriberName = assertDefined(subsriber.name?.[0], 'Subscriber official name');
  const subsriberAddress = assertDefined(subsriber.address?.[0], 'Subscriber address');
  return {
    firstName: assertDefined(subsriberName.given?.[0], 'Subsriber first name'),
    lastName: assertDefined(subsriberName.family, 'Subsriber last name'),
    gender: assertDefined(subsriber.gender as Gender, 'Subsriber gender'),
    patientRelationshipToSubscriberCode: relationshipCode(coverage),
    dateOfBirth: assertDefined(subsriber.birthDate, 'Subsriber birth date'),
    address: {
      address1: assertDefined(subsriberAddress.line?.[0], 'Subsriber address line'),
      city: assertDefined(subsriberAddress.city, 'Subsriber city'),
      state: assertDefined(subsriberAddress.state as State, 'Subsriber state'),
      zipCode: assertDefined(subsriberAddress.postalCode, 'Subsriber postal code'),
    },
    insuranceCard: {
      memberId: assertDefined(coverage.subscriberId, 'Subsriber member id'),
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
  const billingProvierResponse = await apiClient.organizationProviders.v3.get(billingProviderId);
  if (!billingProvierResponse.ok) {
    return STUB_BILLING_PROVIDER_DATA;
  }
  const billingProvider = billingProvierResponse.body;
  const billingProvierAddress = billingProvider.addresses?.[0]?.address;
  if (billingProvierAddress == null) {
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
    addressLine: billingProvierAddress.address1,
    city: billingProvierAddress.city,
    state: billingProvierAddress.state,
    zipCode: billingProvierAddress.zipCode,
    zipPlusFourCode: billingProvierAddress.zipPlusFourCode,
  };
}

async function resourceByReference<T extends FhirResource>(
  reference: Reference | undefined,
  referencePath: string,
  oystehr: Oystehr
): Promise<T> {
  const [resourceType, id] = assertDefined(reference?.reference, referencePath + '.reference').split('/');
  return oystehr.fhir.get<T>({
    resourceType,
    id,
  });
}

/*
  Modify this function in order to add custom logic of selecting a billing provider for "self pay" appointments.
*/
function getSelfPayBillingProvider(): BillingProviderData {
  return STUB_BILLING_PROVIDER_DATA;
}
