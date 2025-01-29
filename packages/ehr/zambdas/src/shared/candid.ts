import {
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
import { CODE_SYSTEM_CMS_PLACE_OF_SERVICE } from 'utils/lib/helpers/rcm';
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
import {
  BillableStatusType,
  EncounterCreate,
  ResponsiblePartyType,
} from 'candidhealth/api/resources/encounters/resources/v4';
import { ServiceLineCreate } from 'candidhealth/api/resources/serviceLines/resources/v2';
import { DateTime } from 'luxon';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/types';
import { assertDefined } from './helpers';

const CODE_SYSTEM_HL7_IDENTIFIER_TYPE = 'http://terminology.hl7.org/CodeSystem/v2-0203';
const CODE_SYSTEM_HL7_SUBSCRIBER_RELATIONSHIP = 'http://terminology.hl7.org/CodeSystem/subscriber-relationship';

const BILLING_PROVIDER: Organization = {
  resourceType: 'Organization',
  name: 'BillingProviderName',
  identifier: [
    {
      system: FHIR_IDENTIFIER_NPI,
      value: 'BillingProviderNpi',
    },
    {
      type: {
        coding: [
          {
            system: CODE_SYSTEM_HL7_IDENTIFIER_TYPE,
            code: 'TAX',
          },
        ],
      },
      value: '123456789',
    },
  ],
  address: [
    {
      line: ['BillingProviderAddressLine'],
      city: 'BillingProviderCity',
      state: 'CA',
      postalCode: '12345-1234',
    },
  ],
};
const SERVICE_FACILITY_LOCATION: Location = {
  resourceType: 'Location',
  name: 'ServiceFacilityName',
  address: {
    line: ['ServiceFacilityAddressLine'],
    city: 'ServiceFacilityCity',
    state: 'CA',
    postalCode: '54321',
  },
  extension: [
    {
      url: CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
      valueString: '20',
    },
  ],
};

export interface InsuranceResources {
  coverage: Coverage;
  subsriber: Patient | RelatedPerson;
  payor: Organization;
}

export interface CreateEncounterInput {
  encounter: Encounter;
  patient: Patient;
  practitioner: Practitioner;
  diagnoses: Condition[];
  procedures: Procedure[];
  insuranceResources?: InsuranceResources;
}

export function candidCreateEncounterRequest(input: CreateEncounterInput): EncounterCreate {
  const { encounter, patient, practitioner, diagnoses, procedures, insuranceResources } = input;
  const patientName = assertDefined(patient.name?.[0], 'Patient name');
  const patientAddress = assertDefined(patient.address?.[0], 'Patient address');
  const billingProviderAddress = assertDefined(BILLING_PROVIDER.address?.[0], 'Billing provider address');
  const billingProviderPostalCodeTokens = assertDefined(
    billingProviderAddress.postalCode,
    'Billing provider postal code'
  ).split('-');
  const practitionerName = assertDefined(practitioner.name?.[0], 'Practitioner name');
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
      organizationName: assertDefined(BILLING_PROVIDER.name, 'Billing provider name'),
      npi: assertDefined(getNpi(BILLING_PROVIDER.identifier), 'Billing provider NPI'),
      taxId: assertDefined(
        getIdentifierValue(BILLING_PROVIDER.identifier, CODE_SYSTEM_HL7_IDENTIFIER_TYPE, 'TAX'),
        'Billing provider TAX ID'
      ),
      address: {
        address1: assertDefined(billingProviderAddress.line?.[0], 'Billing provider address line'),
        city: assertDefined(billingProviderAddress.city, 'Billing provider city'),
        state: assertDefined(billingProviderAddress.state as State, 'Billing provider state'),
        zipCode: billingProviderPostalCodeTokens[0],
        zipPlusFourCode: billingProviderPostalCodeTokens[1],
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
