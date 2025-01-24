import {
  CodeableConcept,
  Condition,
  Coverage,
  Encounter,
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

export interface InsuranceResources {
  coverage: Coverage;
  subsriber: Patient | RelatedPerson;
  payor: Organization;
}

export interface CreateEncounterInput {
  encounter: Encounter;
  patient: Patient;
  practitioner: Practitioner;
  provider: Organization;
  location: Location;
  diagnoses: Condition[];
  procedures: Procedure[];
  insuranceResources?: InsuranceResources;
}

export function candidCreateEncounterRequest(input: CreateEncounterInput): EncounterCreate {
  const { encounter, patient, practitioner, provider, location, diagnoses, procedures, insuranceResources } = input;
  const patientName = assertDefined(patient.name?.[0], 'Patient official name');
  const patientAddress = assertDefined(patient.address?.[0], 'Patient address');
  const providerAddress = assertDefined(provider.address?.[0], 'Provider address');
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
      npi: assertDefined(getNpi(provider.identifier), 'Provider NPI'),
      taxId: assertDefined(
        getIdentifierValue(provider.identifier, CODE_SYSTEM_HL7_IDENTIFIER_TYPE, 'TAX'),
        'Provider TAX ID'
      ),
      address: {
        address1: assertDefined(providerAddress.line?.[0], 'Provider address line'),
        city: assertDefined(providerAddress.city, 'Provider city'),
        state: assertDefined(providerAddress.state as State, 'Provider state'),
        zipCode: assertDefined(providerAddress.postalCode, 'Provider postal code'),
        zipPlusFourCode: assertDefined(providerAddress.postalCode, 'Provider postal code'),
      },
    },
    renderingProvider: {
      npi: assertDefined(getNpi(practitioner.identifier), 'Practitioner NPI'),
    },
    placeOfServiceCode: assertDefined(
      getIdentifierValueBySystem(location.identifier, CODE_SYSTEM_CMS_PLACE_OF_SERVICE) as FacilityTypeCode,
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
            DateTime.fromFormat(
              assertDefined(procedure.meta?.lastUpdated, 'Procedure date'),
              'YYYY-MM-DDThh:mm:ss.sss+zz:zz'
            ).toISODate(),
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
